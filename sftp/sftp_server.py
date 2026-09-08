#!/usr/bin/env python3
"""
SHIELD — Serveur SFTP autonome pour tester le flux de dépôt partenaire.
Ne touche à aucun réglage système du Mac (pas de sudo, pas de nouvel
utilisateur système, pas d'activation de "Remote Login"). C'est un simple
process Python qui écoute sur un port TCP et parle le protocole SFTP.

Le compte "partenaire" n'a accès qu'au dossier sftp/incoming/ (chroot
applicatif) — il ne peut rien voir ni écrire ailleurs sur la machine.
"""
import os
import socket
import sys
import threading

import paramiko

BASE = os.path.dirname(os.path.abspath(__file__))
HOST_KEY_PATH = os.path.join(BASE, "keys", "host_key")
ROOT_DIR = os.path.join(BASE, "incoming")

USERNAME = "partner_test"
PASSWORD = os.environ.get("SHIELD_SFTP_PASSWORD", "ShieldPartner2026!")
PORT = int(os.environ.get("SHIELD_SFTP_PORT", "2222"))


class ShieldSFTPHandle(paramiko.SFTPHandle):
    def stat(self):
        try:
            return paramiko.SFTPAttributes.from_stat(os.fstat(self.readfile.fileno()))
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def chattr(self, attr):
        return paramiko.SFTP_OK


class ShieldSFTPServer(paramiko.SFTPServerInterface):
    def _real(self, path):
        path = path.lstrip("/")
        return os.path.join(ROOT_DIR, path)

    def list_folder(self, path):
        real = self._real(path)
        try:
            out = []
            for fn in os.listdir(real):
                full = os.path.join(real, fn)
                attr = paramiko.SFTPAttributes.from_stat(os.stat(full))
                attr.filename = fn
                out.append(attr)
            return out
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def stat(self, path):
        try:
            return paramiko.SFTPAttributes.from_stat(os.stat(self._real(path)))
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def lstat(self, path):
        try:
            return paramiko.SFTPAttributes.from_stat(os.lstat(self._real(path)))
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def open(self, path, flags, attr):
        real = self._real(path)
        try:
            mode = "ab" if flags & os.O_APPEND else ("wb" if flags & os.O_WRONLY or flags & os.O_CREAT else "rb")
            binflags = os.O_RDONLY
            if flags & os.O_WRONLY:
                binflags = os.O_WRONLY
            if flags & os.O_RDWR:
                binflags = os.O_RDWR
            if flags & os.O_CREAT:
                binflags |= os.O_CREAT
            if flags & os.O_TRUNC:
                binflags |= os.O_TRUNC
            fd = os.open(real, binflags, 0o644)
            f = os.fdopen(fd, mode.replace("b", "") + "b")
            handle = ShieldSFTPHandle(flags)
            handle.readfile = f
            handle.writefile = f
            return handle
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def remove(self, path):
        try:
            os.remove(self._real(path))
            return paramiko.SFTP_OK
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def rename(self, oldpath, newpath):
        try:
            os.rename(self._real(oldpath), self._real(newpath))
            return paramiko.SFTP_OK
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def mkdir(self, path, attr):
        try:
            os.mkdir(self._real(path))
            return paramiko.SFTP_OK
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def rmdir(self, path):
        try:
            os.rmdir(self._real(path))
            return paramiko.SFTP_OK
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def canonicalize(self, path):
        return path if path.startswith("/") else "/" + path


class ShieldServer(paramiko.ServerInterface):
    def __init__(self):
        self.event = threading.Event()

    def check_auth_password(self, username, password):
        if username == USERNAME and password == PASSWORD:
            return paramiko.AUTH_SUCCESSFUL
        return paramiko.AUTH_FAILED

    def check_channel_request(self, kind, chanid):
        return paramiko.OPEN_SUCCEEDED

    def get_allowed_auths(self, username):
        return "password"


def handle_connection(client_sock, host_key):
    transport = paramiko.Transport(client_sock)
    transport.add_server_key(host_key)
    transport.set_subsystem_handler("sftp", paramiko.SFTPServer, sftp_si=ShieldSFTPServer)
    server = ShieldServer()
    try:
        transport.start_server(server=server)
    except Exception as e:
        print(f"Échec handshake SSH: {e}")
        return
    channel = transport.accept(20)
    if channel is None:
        transport.close()
        return
    server.event.wait(3600)


def main():
    os.makedirs(ROOT_DIR, exist_ok=True)
    host_key = paramiko.RSAKey(filename=HOST_KEY_PATH)

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("0.0.0.0", PORT))
    sock.listen(20)
    print(f"[SHIELD SFTP] En écoute sur le port {PORT} — utilisateur '{USERNAME}' — dossier {ROOT_DIR}")
    sys.stdout.flush()

    while True:
        client, addr = sock.accept()
        print(f"[SHIELD SFTP] Connexion de {addr}")
        sys.stdout.flush()
        t = threading.Thread(target=handle_connection, args=(client, host_key), daemon=True)
        t.start()


if __name__ == "__main__":
    main()
