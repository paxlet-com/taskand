"""Opt-in node catalog. Paxlet owns bytes; this module owns local assignments.

Snapshots contain declarations, never approvals, aliases, grants or host paths.
Transport callers must supply the independently authenticated origin. Nothing in
this module executes packages, contacts peers or migrates the legacy registry.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import uuid

from paxlet.manifest import load_manifest
from paxlet.errors import PaxletError
from paxlet.references import URN, exact_digest, exact_version, parse_reference
from paxlet.store import get_package, get_store_dir, put_package

SCHEMA = "taskand.paxlet-catalog/v1"
MAX_ENTRIES = 1000
MAX_SNAPSHOT_BYTES = 1024 * 1024
MAX_REVISION = 2**53 - 1
NAMESPACE = re.compile(r"[a-z0-9]+(?:[.-][a-z0-9]+)*")
NODE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
FIELDS = {"urn", "version", "digest", "revision", "withdrawn"}


class CatalogError(ValueError):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False).encode("utf-8")


def checksum(value):
    return "sha256:" + hashlib.sha256(canonical(value)).hexdigest()


def namespace(urn):
    if not isinstance(urn, str) or len(urn) > 512 or not URN.fullmatch(urn):
        raise CatalogError("invalid package identity")
    parts = urn.split(":")
    if len(parts) < 4 or not NAMESPACE.fullmatch(parts[2]):
        raise CatalogError("catalog identities need a lowercase namespace and package name")
    return parts[2]


def identity(urn, version, digest):
    ns = namespace(urn)
    if not isinstance(version, str) or not 1 <= len(version) <= 128:
        raise CatalogError("exact version is required")
    exact_version(version)
    if not isinstance(digest, str):
        raise CatalogError("exact digest is required")
    exact_digest(digest)
    return ns


def checked_node(value):
    if not isinstance(value, str) or not NODE.fullmatch(value):
        raise CatalogError("invalid node identity")
    return value


def revision(value):
    if type(value) is not int or not 0 <= value <= MAX_REVISION:
        raise CatalogError("invalid revision")


def no_symlinks(path):
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise CatalogError("catalog paths cannot contain symlinks")


def read_snapshot(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise CatalogError("duplicate snapshot field")
            result[key] = value
        return result
    with Path(path).open("rb") as stream:
        raw = stream.read(MAX_SNAPSHOT_BYTES + 1)
    if len(raw) > MAX_SNAPSHOT_BYTES:
        raise CatalogError("snapshot exceeds byte limit")
    return json.loads(raw, object_pairs_hook=unique)


class Catalog:
    def __init__(self, root, *, node_id=None):
        self.root = Path(root).expanduser().absolute()
        no_symlinks(self.root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "catalog.sqlite"
        self.store = get_store_dir()
        if self.root.is_relative_to(self.store):
            raise CatalogError("catalog must be outside immutable package storage")
        if node_id is not None:
            checked_node(node_id)
        with self._db(write=True) as db:
            schema = db.execute("PRAGMA user_version").fetchone()[0]
            if schema not in (0, 1):
                raise CatalogError("unsupported catalog database version")
            if schema == 0:
                if db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchone():
                    raise CatalogError("refusing to initialize an unrelated database")
                for sql in (
                    "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
                    "CREATE TABLE owners (namespace TEXT PRIMARY KEY, origin TEXT NOT NULL)",
                    "CREATE TABLE entries (urn TEXT, version TEXT, origin TEXT NOT NULL, digest TEXT NOT NULL, revision INTEGER NOT NULL, withdrawn INTEGER NOT NULL, PRIMARY KEY(urn,version))",
                    "CREATE TABLE approvals (urn TEXT, version TEXT, digest TEXT NOT NULL, PRIMARY KEY(urn,version))",
                    "CREATE TABLE aliases (binding TEXT, version TEXT, urn TEXT NOT NULL, PRIMARY KEY(binding,version))",
                    "CREATE TABLE origins (origin TEXT PRIMARY KEY, revision INTEGER NOT NULL, checksum TEXT NOT NULL)",
                ):
                    db.execute(sql)
                db.executemany("INSERT INTO meta VALUES (?,?)", (("node", node_id or str(uuid.uuid4())), ("revision", "0")))
                db.execute("PRAGMA user_version=1")
            self.node_id = db.execute("SELECT value FROM meta WHERE key='node'").fetchone()[0]
            checked_node(self.node_id)
            if node_id is not None and node_id != self.node_id:
                raise CatalogError("persisted node identity cannot be replaced")

    @contextmanager
    def _db(self, *, write=False):
        if get_store_dir() != self.store:
            raise CatalogError("package store configuration changed during catalog use")
        for suffix in ("", "-journal", "-wal", "-shm"):
            no_symlinks(Path(str(self.path) + suffix))
        db = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        db.row_factory = sqlite3.Row
        try:
            db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def trust_namespace(self, name, origin):
        """Explicit operator configuration; snapshots cannot grant ownership."""
        if not isinstance(name, str) or not NAMESPACE.fullmatch(name) or len(name) > 128:
            raise CatalogError("invalid namespace")
        checked_node(origin)
        with self._db(write=True) as db:
            old = db.execute("SELECT origin FROM owners WHERE namespace=?", (name,)).fetchone()
            if old and old[0] != origin:
                raise CatalogError("namespace already belongs to another origin")
            db.execute("INSERT OR IGNORE INTO owners VALUES (?,?)", (name, origin))

    @staticmethod
    def _owner(db, urn, origin):
        row = db.execute("SELECT origin FROM owners WHERE namespace=?", (namespace(urn),)).fetchone()
        if row is None or row[0] != origin:
            raise CatalogError("origin is not the configured namespace owner")

    @staticmethod
    def _next_revision(db):
        number = int(db.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0]) + 1
        revision(number)
        db.execute("UPDATE meta SET value=? WHERE key='revision'", (str(number),))
        return number

    @staticmethod
    def _entry(row):
        return {key: bool(row[key]) if key == "withdrawn" else row[key] for key in sorted(FIELDS)}

    @staticmethod
    def _verified(urn, version, digest):
        package = get_package(digest)
        if package is None:
            raise CatalogError("verified package content is missing")
        _, manifest = load_manifest(package)
        if (manifest["identity"]["urn"], manifest["identity"]["version"]) != (urn, version):
            raise CatalogError("package content does not match catalog identity/version")
        return manifest

    def install(self, source, *, expected_digest):
        """Publish an owned declaration after Paxlet has atomically installed bytes."""
        if expected_digest is None:
            raise CatalogError("installation requires a digest pin")
        digest, _, package = put_package(source, expected_digest=expected_digest)
        _, manifest = load_manifest(package)
        urn, version = manifest["identity"]["urn"], manifest["identity"]["version"]
        identity(urn, version, digest)
        with self._db(write=True) as db:
            self._owner(db, urn, self.node_id)
            old = db.execute("SELECT * FROM entries WHERE urn=? AND version=?", (urn, version)).fetchone()
            if old:
                if old["digest"] != digest or old["withdrawn"]:
                    raise CatalogError("immutable identity/version conflict or withdrawal")
                return self._entry(old)
            if db.execute("SELECT count(*) FROM entries WHERE origin=?", (self.node_id,)).fetchone()[0] >= MAX_ENTRIES:
                raise CatalogError("origin entry limit reached; withdrawals cannot be discarded")
            number = self._next_revision(db)
            db.execute("INSERT INTO entries VALUES (?,?,?,?,?,0)", (urn, version, self.node_id, digest, number))
            return {"urn": urn, "version": version, "digest": digest, "revision": number, "withdrawn": False}

    def approve(self, urn, version, digest, *, bindings=()):
        """Activate exact local content; alias registration is an explicit decision."""
        identity(urn, version, digest)
        if not isinstance(bindings, (list, tuple)) or len(bindings) > 64 or any(not isinstance(b, str) for b in bindings):
            raise CatalogError("invalid aliases")
        if len(set(bindings)) != len(bindings):
            raise CatalogError("duplicate aliases")
        with self._db(write=True) as db:
            row = db.execute("SELECT * FROM entries WHERE urn=? AND version=?", (urn, version)).fetchone()
            if not row or row["withdrawn"] or row["digest"] != digest:
                raise CatalogError("approval does not match a live candidate")
            manifest = self._verified(urn, version, digest)
            for binding in bindings:
                ref = parse_reference(binding)
                if (not binding.startswith("paxlet://") or ref.action or ref.version
                        or binding not in manifest.get("bindings", [])):
                    raise CatalogError("alias is not a declared package binding")
                # An owner cannot claim a different namespace through an alias.
                if binding.split("/")[2] != namespace(urn):
                    raise CatalogError("alias namespace differs from package owner")
                conflict = db.execute("SELECT urn FROM aliases WHERE binding=? AND urn<>?", (binding, urn)).fetchone()
                if conflict:
                    raise CatalogError("alias is already assigned to another package")
            db.execute("INSERT OR REPLACE INTO approvals VALUES (?,?,?)", (urn, version, digest))
            for binding in bindings:
                db.execute("INSERT OR IGNORE INTO aliases VALUES (?,?,?)", (binding, version, urn))

    def withdraw(self, urn, version, digest):
        identity(urn, version, digest)
        with self._db(write=True) as db:
            self._owner(db, urn, self.node_id)
            row = db.execute("SELECT * FROM entries WHERE urn=? AND version=?", (urn, version)).fetchone()
            if not row or row["digest"] != digest:
                raise CatalogError("withdrawal does not match a known declaration")
            if not row["withdrawn"]:
                db.execute("UPDATE entries SET withdrawn=1, revision=? WHERE urn=? AND version=?", (self._next_revision(db), urn, version))
                self._deactivate(db, urn, version)

    def deactivate(self, urn, version, digest):
        """Revoke only local activation, including for a remotely owned package."""
        identity(urn, version, digest)
        with self._db(write=True) as db:
            row = db.execute("SELECT digest FROM entries WHERE urn=? AND version=?", (urn, version)).fetchone()
            if row is None or row[0] != digest:
                raise CatalogError("deactivation does not match local content")
            self._deactivate(db, urn, version)

    @staticmethod
    def _deactivate(db, urn, version):
        db.execute("DELETE FROM approvals WHERE urn=? AND version=?", (urn, version))
        db.execute("DELETE FROM aliases WHERE urn=? AND version=?", (urn, version))

    def records(self):
        with self._db() as db:
            records = []
            for row in db.execute("SELECT e.*, a.digest AS approved FROM entries e LEFT JOIN approvals a USING(urn,version) ORDER BY e.urn,e.version"):
                record = {**self._entry(row), "origin": row["origin"], "approved": row["approved"] == row["digest"] and not row["withdrawn"]}
                record["actions"] = {} if row["withdrawn"] else self._verified(row["urn"], row["version"], row["digest"])["actions"]
                records.append(record)
            return records

    def resolve(self, selector, *, action=None, version=None, digest=None):
        ref = parse_reference(selector)
        exact_version(version)
        if (action is not None and ref.action is not None and action != ref.action
                or version is not None and ref.version is not None and version != ref.version):
            raise CatalogError("conflicting action/version selectors")
        action, version = action or ref.action, version or ref.version
        exact_version(version)
        exact_digest(digest)
        with self._db() as db:
            if ref.package.startswith("urn:paxlet:"):
                urn = ref.package
            else:
                assignments = db.execute("SELECT DISTINCT urn FROM aliases WHERE binding=?", (ref.package,)).fetchall()
                if len(assignments) != 1:
                    raise CatalogError("unknown or ambiguous approved alias")
                urn = assignments[0][0]
            rows = db.execute("SELECT e.* FROM entries e JOIN approvals a USING(urn,version) WHERE e.urn=? AND e.withdrawn=0 AND e.digest=a.digest", (urn,)).fetchall()
            rows = [r for r in rows if (version is None or r["version"] == version) and (digest is None or r["digest"] == digest)]
            if not ref.package.startswith("urn:paxlet:"):
                rows = [r for r in rows if db.execute("SELECT 1 FROM aliases WHERE binding=? AND version=? AND urn=?", (ref.package, r["version"], urn)).fetchone()]
            if len(rows) != 1:
                raise CatalogError("select one approved package version and digest")
            row = rows[0]
            manifest = self._verified(urn, row["version"], row["digest"])
            if not isinstance(action, str) or action not in manifest["actions"]:
                raise CatalogError("unknown action")
            return {"package": urn, "version": row["version"], "digest": row["digest"], "action": action}

    def snapshot(self):
        with self._db() as db:
            result = {"schema": SCHEMA, "origin": self.node_id,
                      "revision": int(db.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0]),
                      "entries": [self._entry(r) for r in db.execute("SELECT * FROM entries WHERE origin=? ORDER BY urn,version", (self.node_id,))]}
        result["checksum"] = checksum(result)
        if len(canonical(result)) > MAX_SNAPSHOT_BYTES:
            raise CatalogError("snapshot exceeds byte limit")
        return result

    @staticmethod
    def _check_snapshot(snapshot, authenticated_origin):
        checked_node(authenticated_origin)
        if not isinstance(snapshot, dict) or set(snapshot) != {"schema", "origin", "revision", "entries", "checksum"}:
            raise CatalogError("invalid snapshot envelope")
        if len(canonical(snapshot)) > MAX_SNAPSHOT_BYTES:
            raise CatalogError("snapshot exceeds byte limit")
        if snapshot["schema"] != SCHEMA or snapshot["origin"] != authenticated_origin:
            raise CatalogError("snapshot origin/schema does not match transport authority")
        revision(snapshot["revision"])
        exact_digest(snapshot["checksum"])
        body = {k: v for k, v in snapshot.items() if k != "checksum"}
        if snapshot["checksum"] != checksum(body):
            raise CatalogError("snapshot checksum mismatch")
        entries = snapshot["entries"]
        if not isinstance(entries, list) or len(entries) > MAX_ENTRIES:
            raise CatalogError("invalid or oversized entry collection")
        seen = set()
        for entry in entries:
            if not isinstance(entry, dict) or set(entry) != FIELDS:
                raise CatalogError("invalid snapshot entry")
            identity(entry["urn"], entry["version"], entry["digest"])
            revision(entry["revision"])
            if type(entry["withdrawn"]) is not bool or not 0 < entry["revision"] <= snapshot["revision"]:
                raise CatalogError("invalid entry revision/withdrawal")
            key = (entry["urn"], entry["version"])
            if key in seen:
                raise CatalogError("duplicate package identity/version")
            seen.add(key)
        if (not entries and snapshot["revision"] != 0) or (entries and max(e["revision"] for e in entries) != snapshot["revision"]):
            raise CatalogError("snapshot does not include its latest revision")
        return entries

    def _preflight(self, db, snapshot, origin):
        if origin == self.node_id:
            raise CatalogError("remote snapshot cannot replace this node's declarations")
        if not db.execute("SELECT 1 FROM owners WHERE origin=?", (origin,)).fetchone():
            raise CatalogError("unknown origin")
        previous = db.execute("SELECT * FROM origins WHERE origin=?", (origin,)).fetchone()
        if previous:
            if snapshot["revision"] < previous["revision"]:
                raise CatalogError("stale snapshot")
            if snapshot["revision"] == previous["revision"] and snapshot["checksum"] != previous["checksum"]:
                raise CatalogError("origin equivocated at an accepted revision")
        incoming = {(e["urn"], e["version"]): e for e in snapshot["entries"]}
        for old in db.execute("SELECT * FROM entries WHERE origin=?", (origin,)):
            entry = incoming.get((old["urn"], old["version"]))
            if entry is None:
                raise CatalogError("full snapshot omitted a declaration or withdrawal")
            if (old["digest"] != entry["digest"] or entry["revision"] < old["revision"]
                    or old["withdrawn"] and not entry["withdrawn"]
                    or entry["revision"] == old["revision"] and entry != self._entry(old)):
                raise CatalogError("immutable assignment or withdrawal conflict")
        for entry in snapshot["entries"]:
            self._owner(db, entry["urn"], origin)
            old = db.execute("SELECT origin FROM entries WHERE urn=? AND version=?", (entry["urn"], entry["version"])).fetchone()
            if old and old[0] != origin:
                raise CatalogError("competing origin assignment")
            if old is None and previous and entry["revision"] <= previous["revision"]:
                raise CatalogError("new declaration predates the accepted full snapshot")
        return previous is not None and snapshot["revision"] == previous["revision"]

    def apply_snapshot(self, snapshot, *, authenticated_origin, archives=None):
        """Verify bytes before a single catalog commit; orphaned bytes are harmless.

        `archives` is an operator/transport-provided digest-to-local-file mapping.
        No path, credential or origin authority is accepted from snapshot content.
        """
        # Detach caller-owned mutable structures before verification and I/O.
        snapshot = json.loads(canonical(snapshot))
        entries = self._check_snapshot(snapshot, authenticated_origin)
        with self._db() as db:
            self._preflight(db, snapshot, authenticated_origin)
        for entry in entries:
            if entry["withdrawn"]:
                continue
            if get_package(entry["digest"]) is None:
                source = (archives or {}).get(entry["digest"])
                if source is None:
                    raise CatalogError("snapshot package is missing; no catalog change")
                put_package(source, expected_digest=entry["digest"])
            self._verified(entry["urn"], entry["version"], entry["digest"])
        with self._db(write=True) as db:
            unchanged = self._preflight(db, snapshot, authenticated_origin)
            if not unchanged:
                for entry in entries:
                    db.execute("INSERT INTO entries VALUES (?,?,?,?,?,?) ON CONFLICT(urn,version) DO UPDATE SET revision=excluded.revision, withdrawn=excluded.withdrawn", (entry["urn"], entry["version"], authenticated_origin, entry["digest"], entry["revision"], int(entry["withdrawn"])))
                    if entry["withdrawn"]:
                        self._deactivate(db, entry["urn"], entry["version"])
                db.execute("INSERT OR REPLACE INTO origins VALUES (?,?,?)", (authenticated_origin, snapshot["revision"], snapshot["checksum"]))
        return {"origin": authenticated_origin, "revision": snapshot["revision"], "changed": not unchanged, "entries": len(entries)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="Operator-selected local catalog directory")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init").add_argument("--node-id")
    trust = sub.add_parser("trust")
    trust.add_argument("namespace")
    trust.add_argument("origin")
    install = sub.add_parser("install")
    install.add_argument("source")
    install.add_argument("--digest", required=True)
    for command in ("approve", "withdraw", "deactivate"):
        p = sub.add_parser(command)
        p.add_argument("urn")
        p.add_argument("--version", required=True)
        p.add_argument("--digest", required=True)
        if command == "approve":
            p.add_argument("--binding", action="append", default=[])
    sub.add_parser("list")
    sub.add_parser("snapshot")
    resolve = sub.add_parser("resolve")
    resolve.add_argument("selector")
    resolve.add_argument("--action")
    resolve.add_argument("--version")
    resolve.add_argument("--digest")
    apply = sub.add_parser("apply")
    apply.add_argument("snapshot")
    apply.add_argument("--origin", required=True, help="Independently authenticated origin or explicit local operator assertion")
    apply.add_argument("--archives", help="Directory with <digest-hex>.paxlet.zip files")
    args = parser.parse_args(argv)
    try:
        catalog = Catalog(args.root, node_id=getattr(args, "node_id", None))
        result = {"ok": True}
        if args.command == "init":
            result["node"] = catalog.node_id
        elif args.command == "trust":
            catalog.trust_namespace(args.namespace, args.origin)
        elif args.command == "install":
            result = catalog.install(args.source, expected_digest=args.digest)
        elif args.command == "approve":
            catalog.approve(args.urn, args.version, args.digest, bindings=args.binding)
        elif args.command == "withdraw":
            catalog.withdraw(args.urn, args.version, args.digest)
        elif args.command == "deactivate":
            catalog.deactivate(args.urn, args.version, args.digest)
        elif args.command == "resolve":
            result = catalog.resolve(args.selector, action=args.action, version=args.version, digest=args.digest)
        elif args.command == "list":
            result = catalog.records()
        elif args.command == "snapshot":
            result = catalog.snapshot()
        elif args.command == "apply":
            snapshot = read_snapshot(args.snapshot)
            entries = catalog._check_snapshot(snapshot, args.origin)
            archives = {e["digest"]: Path(args.archives) / (e["digest"][7:] + ".paxlet.zip") for e in entries} if args.archives else {}
            result = catalog.apply_snapshot(snapshot, authenticated_origin=args.origin, archives=archives)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ValueError, RuntimeError, OSError, sqlite3.Error, PaxletError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
