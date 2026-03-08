#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@file hot-deploy.py
@brief 研究生套磁管理系统免重建热发布脚本。

该脚本面向 Windows + PowerShell 本地开发机，使用 Paramiko 连接远端 Linux 服务器，
支持以下发布模式：
- init：首次固化热发布链路，上传构建产物并强制重建 app / caddy 服务。
- client：仅发布前端静态资源，不重启应用容器。
- server：仅发布后端构建产物与运行脚本，并强制重建 app 服务。
- all：发布前后端构建产物，并强制重建 app 服务。
- check：仅执行远端挂载、容器状态与健康检查。

说明：
- 若新增了 Node 运行时依赖、原生依赖或基础镜像依赖，仍需使用 Docker 镜像重建。
- 若只是前端页面、后端 TS 逻辑、Prisma 迁移/脚本调整，可优先使用本脚本。
- server / all 使用 docker compose force recreate，既能刷新 Node 进程，也能应用新的 Compose 配置。
"""

from __future__ import annotations

import argparse
import os
import posixpath
import shlex
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable

try:
    import paramiko
except ImportError as exc:  # pragma: no cover
    raise SystemExit('未安装 paramiko，请先执行：python -m pip install paramiko') from exc

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE_NAME = '.env.hot-deploy.local'
AGENTS_FILE_NAME = 'AGENTS.md'
APP_MOUNT_DESTINATIONS = (
    '/app/packages/client/dist',
    '/app/packages/server/dist',
    '/app/packages/shared/dist',
    '/app/scripts',
    '/app/prisma',
)


class DeployError(RuntimeError):
    """@brief 热发布过程中的业务错误。"""


def log_step(message: str) -> None:
    """@brief 输出步骤日志。
    @param message 日志内容。
    """
    print(f'[hot-deploy] {message}')


def quote_remote(value: str) -> str:
    """@brief 对远端 shell 参数做安全转义。
    @param value 原始值。
    @returns 适用于远端 shell 的安全字符串。
    """
    return shlex.quote(value)


def run_local(command: list[str]) -> None:
    """@brief 在本地执行命令并检查返回码。
    @param command 命令数组。
    @throws DeployError 命令执行失败时抛出。
    """
    log_step(f'本地执行：{" ".join(command)}')
    command_input: list[str] | str = command
    use_shell = False
    if os.name == 'nt':
        command_input = subprocess.list2cmdline(command)
        use_shell = True
    result = subprocess.run(command_input, cwd=PROJECT_ROOT, check=False, shell=use_shell)
    if result.returncode != 0:
        raise DeployError(f'本地命令执行失败：{" ".join(command)}')


def load_env_file() -> None:
    """@brief 从本地热发布配置文件读取环境变量。"""
    env_path = PROJECT_ROOT / ENV_FILE_NAME
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding='utf-8').splitlines():
        content = line.strip()
        if not content or content.startswith('#') or '=' not in content:
            continue
        key, value = content.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def read_agents_lines() -> list[str]:
    """@brief 读取项目 AGENTS.md 内容。
    @returns AGENTS.md 按行拆分后的列表，不存在时返回空列表。
    """
    agents_path = PROJECT_ROOT / AGENTS_FILE_NAME
    if not agents_path.exists():
        return []
    return agents_path.read_text(encoding='utf-8').splitlines()


def load_agents_defaults() -> None:
    """@brief 从项目 AGENTS.md 自动读取服务器默认配置。"""
    mapping = {
        '服务器IP': 'DEPLOY_HOST',
        'SSH端口': 'DEPLOY_PORT',
        'SSH用户': 'DEPLOY_USER',
        'SSH密码': 'DEPLOY_PASSWORD',
        '远端目录': 'DEPLOY_REMOTE_DIR',
    }

    agents_lines = read_agents_lines()
    for line in agents_lines:
        content = line.strip()
        if not content.startswith('- ') or '：' not in content:
            continue
        key, value = content[2:].split('：', 1)
        env_key = mapping.get(key.strip())
        if not env_key or env_key in os.environ:
            continue
        normalized = value.strip().strip('`').strip()
        if normalized:
            os.environ[env_key] = normalized

    if 'DEPLOY_HEALTH_URL' not in os.environ:
        for line in agents_lines:
            content = line.strip()
            if not content.startswith('- 域名：'):
                continue
            raw = content.split('：', 1)[1].strip()
            domain = raw.split('、')[0].strip().strip('`')
            if domain:
                os.environ['DEPLOY_HEALTH_URL'] = f'https://{domain}/api/health'
            break


def get_required_env(key: str) -> str:
    """@brief 读取必填环境变量。
    @param key 环境变量名。
    @returns 环境变量值。
    @throws DeployError 环境变量缺失时抛出。
    """
    value = os.environ.get(key, '').strip()
    if not value:
        raise DeployError(f'缺少环境变量：{key}。请先配置 {ENV_FILE_NAME} 或系统环境变量。')
    return value


def get_remote_root() -> str:
    """@brief 获取远端项目目录。
    @returns 远端项目目录。
    """
    return os.environ.get('DEPLOY_REMOTE_DIR', '/opt/postgrad-contact-manager').strip() or '/opt/postgrad-contact-manager'


def get_app_container_name() -> str:
    """@brief 获取应用容器名。
    @returns 应用容器名称。
    """
    return os.environ.get('DEPLOY_CONTAINER_NAME', 'postgrad-contact-manager').strip() or 'postgrad-contact-manager'


def get_proxy_container_name() -> str:
    """@brief 获取代理容器名。
    @returns 代理容器名称。
    """
    return os.environ.get('DEPLOY_PROXY_CONTAINER_NAME', 'postgrad-contact-manager-caddy').strip() or 'postgrad-contact-manager-caddy'


def connect_ssh() -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    """@brief 建立 SSH 与 SFTP 连接。
    @returns SSHClient 与 SFTPClient。
    """
    host = get_required_env('DEPLOY_HOST')
    user = get_required_env('DEPLOY_USER')
    password = get_required_env('DEPLOY_PASSWORD')
    port = int(os.environ.get('DEPLOY_PORT', '22'))

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host,
        port=port,
        username=user,
        password=password,
        timeout=20,
        look_for_keys=False,
        allow_agent=False,
    )
    return client, client.open_sftp()


def ssh_exec(client: paramiko.SSHClient, command: str, timeout: int = 600) -> str:
    """@brief 在远端执行命令。
    @param client SSH 客户端。
    @param command 要执行的远端命令。
    @param timeout 超时时间（秒）。
    @returns 标准输出文本。
    @throws DeployError 命令执行失败时抛出。
    """
    log_step(f'远端执行：{command}')
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    output = stdout.read().decode('utf-8', errors='ignore')
    error = stderr.read().decode('utf-8', errors='ignore')
    status = stdout.channel.recv_exit_status()
    if status != 0:
        detail = error.strip() or output.strip() or '无错误输出'
        raise DeployError(f'远端命令失败：{command}\n{detail}')
    return output


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    """@brief 确保远端目录存在。
    @param sftp SFTP 客户端。
    @param remote_dir 远端目录。
    """
    parts = [part for part in remote_dir.split('/') if part]
    current = '/'
    for part in parts:
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def upload_file(sftp: paramiko.SFTPClient, local_path: Path, remote_path: str) -> None:
    """@brief 上传单个文件。
    @param sftp SFTP 客户端。
    @param local_path 本地文件路径。
    @param remote_path 远端文件路径。
    """
    ensure_remote_dir(sftp, posixpath.dirname(remote_path))
    sftp.put(str(local_path), remote_path)
    log_step(f'已上传文件：{local_path.relative_to(PROJECT_ROOT).as_posix()}')


def should_skip_directory(name: str) -> bool:
    """@brief 判断目录是否应在上传时忽略。
    @param name 目录名。
    @returns 是否忽略。
    """
    return name in {'__pycache__', '.git', '.turbo', 'node_modules'}


def should_skip_file(name: str) -> bool:
    """@brief 判断文件是否应在上传时忽略。
    @param name 文件名。
    @returns 是否忽略。
    """
    return name in {'.DS_Store'} or name.endswith(('.pyc', '.pyo'))


def upload_directory(sftp: paramiko.SFTPClient, local_dir: Path, remote_dir: str) -> None:
    """@brief 递归上传目录。
    @param sftp SFTP 客户端。
    @param local_dir 本地目录。
    @param remote_dir 远端目录。
    """
    ensure_remote_dir(sftp, remote_dir)
    for root, dirs, files in os.walk(local_dir):
        dirs[:] = [name for name in dirs if not should_skip_directory(name)]
        relative_root = Path(root).relative_to(local_dir).as_posix()
        current_remote = remote_dir if relative_root == '.' else posixpath.join(remote_dir, relative_root)
        ensure_remote_dir(sftp, current_remote)
        for filename in files:
            if should_skip_file(filename):
                continue
            local_file = Path(root) / filename
            remote_file = posixpath.join(current_remote, filename)
            sftp.put(str(local_file), remote_file)
    log_step(f'已上传目录：{local_dir.relative_to(PROJECT_ROOT).as_posix()}')


def clean_remote_path(client: paramiko.SSHClient, remote_path: str) -> None:
    """@brief 清空远端目录内容但保留目录本身。
    @param client SSH 客户端。
    @param remote_path 远端目录。
    """
    quoted = quote_remote(remote_path)
    ssh_exec(client, f"mkdir -p {quoted} && find {quoted} -mindepth 1 -maxdepth 1 -exec rm -rf {{}} +")


def require_local_paths(paths: Iterable[Path]) -> None:
    """@brief 校验本地必需文件或目录是否存在。
    @param paths 需要校验的相对路径列表。
    @throws DeployError 缺失时抛出。
    """
    missing = [path.as_posix() for path in paths if not (PROJECT_ROOT / path).exists()]
    if missing:
        raise DeployError(
            '本地缺少发布所需文件，请先完成构建或检查工程文件：' + ', '.join(missing)
        )


def build_targets(target: str) -> None:
    """@brief 根据目标执行本地构建。
    @param target 发布目标。
    """
    if target in {'init', 'client', 'all'}:
        run_local(['pnpm', '--filter', 'client', 'build'])
    if target in {'init', 'server', 'all'}:
        run_local(['pnpm', '--filter', 'shared', 'build'])
        run_local(['pnpm', '--filter', 'server', 'build'])


def validate_local_artifacts(target: str) -> None:
    """@brief 校验当前目标所需的本地发布产物。
    @param target 发布目标。
    """
    common_server_paths = (
        Path('scripts'),
        Path('prisma'),
        Path('deploy'),
        Path('docker-compose.yml'),
        Path('Dockerfile'),
        Path('package.json'),
        Path('pnpm-lock.yaml'),
        Path('pnpm-workspace.yaml'),
    )

    if target in {'init', 'client', 'all'}:
        require_local_paths((Path('packages/client/dist'),))
    if target in {'init', 'server', 'all'}:
        require_local_paths(
            (
                Path('packages/server/dist'),
                Path('packages/shared/dist'),
                *common_server_paths,
            )
        )


def sync_client_assets(client: paramiko.SSHClient, sftp: paramiko.SFTPClient, remote_root: str) -> None:
    """@brief 同步前端构建产物。
    @param client SSH 客户端。
    @param sftp SFTP 客户端。
    @param remote_root 远端项目根目录。
    """
    remote_dist = f'{remote_root}/packages/client/dist'
    clean_remote_path(client, remote_dist)
    upload_directory(sftp, PROJECT_ROOT / 'packages' / 'client' / 'dist', remote_dist)


def sync_server_assets(client: paramiko.SSHClient, sftp: paramiko.SFTPClient, remote_root: str) -> None:
    """@brief 同步后端运行所需构建产物与脚本。
    @param client SSH 客户端。
    @param sftp SFTP 客户端。
    @param remote_root 远端项目根目录。
    """
    mirrored_directories = (
        Path('packages/server/dist'),
        Path('packages/shared/dist'),
        Path('scripts'),
        Path('prisma'),
        Path('deploy'),
    )
    mirrored_files = (
        Path('docker-compose.yml'),
        Path('Dockerfile'),
        Path('package.json'),
        Path('pnpm-lock.yaml'),
        Path('pnpm-workspace.yaml'),
    )

    for relative_dir in mirrored_directories:
        clean_remote_path(client, f'{remote_root}/{relative_dir.as_posix()}')
        upload_directory(sftp, PROJECT_ROOT / relative_dir, f'{remote_root}/{relative_dir.as_posix()}')

    for relative_file in mirrored_files:
        upload_file(sftp, PROJECT_ROOT / relative_file, f'{remote_root}/{relative_file.as_posix()}')


def refresh_services(
    client: paramiko.SSHClient,
    remote_root: str,
    services: Iterable[str],
    force_recreate: bool = True,
) -> None:
    """@brief 刷新远端服务，确保新配置与新产物立即生效。
    @param client SSH 客户端。
    @param remote_root 远端项目根目录。
    @param services 需要刷新的服务列表。
    @param force_recreate 是否强制重建容器。
    """
    services_text = ' '.join(services)
    recreate_flag = ' --force-recreate' if force_recreate else ''
    quoted_root = quote_remote(remote_root)
    ssh_exec(
        client,
        f"cd {quoted_root} && docker compose config -q && docker compose up -d --no-deps{recreate_flag} {services_text}",
        timeout=1200,
    )


def get_container_mounts(client: paramiko.SSHClient, container_name: str) -> set[str]:
    """@brief 获取容器挂载目标目录集合。
    @param client SSH 客户端。
    @param container_name 容器名称。
    @returns 容器内挂载目标目录集合。
    """
    output = ssh_exec(
        client,
        f"docker inspect {quote_remote(container_name)} --format '{{{{range .Mounts}}}}{{{{println .Destination}}}}{{{{end}}}}'",
        timeout=120,
    )
    return {line.strip() for line in output.splitlines() if line.strip()}


def has_container_mount(client: paramiko.SSHClient, container_name: str, destination: str) -> bool:
    """@brief 判断容器是否已挂载指定目录。
    @param client SSH 客户端。
    @param container_name 容器名称。
    @param destination 容器内挂载目标目录。
    @returns 是否存在对应挂载。
    """
    return destination in get_container_mounts(client, container_name)


def copy_client_dist_into_container(client: paramiko.SSHClient, remote_root: str, container_name: str) -> None:
    """@brief 兼容尚未完成挂载固化时的前端热替换。
    @param client SSH 客户端。
    @param remote_root 远端项目根目录。
    @param container_name 应用容器名称。
    """
    if has_container_mount(client, container_name, '/app/packages/client/dist'):
        log_step('检测到前端 dist 已挂载，跳过容器内复制步骤')
        return

    log_step('当前应用容器尚未完成前端 dist 挂载，本次使用兼容复制方案；建议尽快重新执行 init 固化挂载')
    quoted_container = quote_remote(container_name)
    quoted_remote_root = quote_remote(remote_root)
    ssh_exec(
        client,
        f"docker exec {quoted_container} sh -lc 'mkdir -p /app/packages/client/dist && rm -rf /app/packages/client/dist/*'",
    )
    ssh_exec(
        client,
        f"docker cp {quoted_remote_root}/packages/client/dist/. {quoted_container}:/app/packages/client/dist/",
        timeout=1200,
    )


def print_container_status(client: paramiko.SSHClient, container_names: Iterable[str]) -> None:
    """@brief 打印指定容器的运行状态。
    @param client SSH 客户端。
    @param container_names 需要展示状态的容器列表。
    """
    for container_name in container_names:
        output = ssh_exec(
            client,
            (
                'docker inspect '
                f"{quote_remote(container_name)} --format '{{{{.Name}}}}\t{{{{.State.Status}}}}\t{{{{if .State.Health}}}}{{{{.State.Health.Status}}}}{{{{else}}}}-{{{{end}}}}'"
            ),
            timeout=120,
        )
        print(output.strip())


def verify_mounts(client: paramiko.SSHClient, container_name: str) -> None:
    """@brief 验证应用容器关键挂载是否已全部到位。
    @param client SSH 客户端。
    @param container_name 应用容器名称。
    @throws DeployError 挂载缺失时抛出。
    """
    mounts = get_container_mounts(client, container_name)
    missing = [destination for destination in APP_MOUNT_DESTINATIONS if destination not in mounts]
    if missing:
        raise DeployError('应用容器挂载缺失，请重新执行 pnpm deploy:hot:init：' + ', '.join(missing))
    print('[hot-deploy] 挂载检查通过：' + ', '.join(APP_MOUNT_DESTINATIONS))


def verify_public_health(client: paramiko.SSHClient, health_url: str) -> None:
    """@brief 从远端服务器发起外网健康检查。
    @param client SSH 客户端。
    @param health_url 健康检查 URL。
    """
    quoted_url = quote_remote(health_url)
    command = (
        f"if command -v curl >/dev/null 2>&1; then curl -fsS {quoted_url}; "
        f"elif command -v wget >/dev/null 2>&1; then wget -qO- {quoted_url}; "
        "else echo '未安装 curl 或 wget，无法执行健康检查' >&2; exit 1; fi"
    )
    output = ssh_exec(client, command, timeout=120)
    print(output.strip())


def verify_remote(client: paramiko.SSHClient, target: str) -> None:
    """@brief 校验远端服务状态。
    @param client SSH 客户端。
    @param target 发布目标。
    """
    app_container_name = get_app_container_name()
    proxy_container_name = get_proxy_container_name()
    health_url = os.environ.get('DEPLOY_HEALTH_URL', '').strip()
    wait_seconds = int(os.environ.get('DEPLOY_WAIT_SECONDS', '8'))

    if target in {'init', 'server', 'all'}:
        log_step(f'等待应用容器恢复：{wait_seconds} 秒')
        time.sleep(wait_seconds)

    print_container_status(client, (app_container_name, proxy_container_name))

    if target in {'init', 'server', 'all', 'check'}:
        verify_mounts(client, app_container_name)

    if health_url:
        verify_public_health(client, health_url)


def parse_args() -> argparse.Namespace:
    """@brief 解析命令行参数。"""
    parser = argparse.ArgumentParser(description='研究生套磁管理系统热发布脚本')
    parser.add_argument(
        '--target',
        choices=['init', 'client', 'server', 'all', 'check'],
        default='client',
        help='发布目标：init/client/server/all/check',
    )
    parser.add_argument('--skip-build', action='store_true', help='跳过本地构建，直接同步现有产物')
    return parser.parse_args()


def main() -> None:
    """@brief 主执行入口。"""
    load_env_file()
    load_agents_defaults()
    args = parse_args()
    remote_root = get_remote_root()
    app_container_name = get_app_container_name()

    if args.target != 'check':
        if not args.skip_build:
            build_targets(args.target)
        validate_local_artifacts(args.target)

    client, sftp = connect_ssh()
    try:
        if args.target == 'check':
            verify_remote(client, args.target)
            log_step('远端验收检查完成')
            return

        if args.target in {'init', 'client', 'all'}:
            sync_client_assets(client, sftp, remote_root)

        if args.target in {'init', 'server', 'all'}:
            sync_server_assets(client, sftp, remote_root)

        if args.target == 'init':
            refresh_services(client, remote_root, ('app', 'caddy'))
        elif args.target == 'client':
            copy_client_dist_into_container(client, remote_root, app_container_name)
        elif args.target in {'server', 'all'}:
            refresh_services(client, remote_root, ('app',))

        verify_remote(client, args.target)
        log_step(f'热发布完成：{args.target}')
    finally:
        sftp.close()
        client.close()


if __name__ == '__main__':
    try:
        main()
    except DeployError as error:
        print(f'[hot-deploy] 失败：{error}', file=sys.stderr)
        sys.exit(1)
