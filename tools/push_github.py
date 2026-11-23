#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把《鲸选暗线》一次性推成一个 GitHub 仓库（不需要本机装 git）。

用 GitHub Git Data API：blob -> tree -> commit -> ref，一次提交含全部文件。

用法（token 从环境变量读，避免落进命令历史）：
    set GH_TOKEN=ghp_xxx
    python tools/push_github.py --repo jingxuan-dark-line
    python tools/push_github.py --repo jingxuan-dark-line --dry-run

可选：
    --owner   默认取 token 所属账号
    --private 建私有仓库（默认公开）
    --desc    仓库描述
    --branch  默认 main
"""

import argparse, base64, json, os, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

API = "https://api.github.com"

# 不传的目录（相对项目根）。截图按用户要求排除；node_modules 是 puppeteer 依赖。
EXCLUDE_DIRS = {"shots", "node_modules"}
EXCLUDE_FILES = {".DS_Store", "Thumbs.db"}


def req(method, path, token, payload=None, timeout=60):
    url = API + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("Authorization", "Bearer " + token)
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    r.add_header("User-Agent", "jingxuan-dark-line-pusher")
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise SystemExit("HTTP %s %s\n%s" % (e.code, path, body[:800]))


def collect(root):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS and not d.startswith(".git"))
        for fn in sorted(filenames):
            if fn in EXCLUDE_FILES:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            out.append((rel, full))
    return out


def make_blob(root, item, token, prefix):
    rel, full = item
    with open(full, "rb") as f:
        raw = f.read()
    payload = {"content": base64.b64encode(raw).decode("ascii"), "encoding": "base64"}
    res = req("POST", prefix + "/git/blobs", token, payload, timeout=180)
    return rel, res["sha"], len(raw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--owner")
    ap.add_argument("--repo", default="jingxuan-dark-line")
    ap.add_argument("--branch", default="main")
    ap.add_argument("--desc", default="《鲸选暗线》—— 一个单文件 HTML 解密游戏：在 1947 年的旧商城网页里找线索，把四件日用品凑齐，进 S07 归档区暗网，向老鸦上报 K-07。")
    ap.add_argument("--private", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--files", nargs="*", help="只提交这些相对路径（增量更新，其余文件保持不动）")
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    files = collect(args.root)
    if args.files:
        keep = {p.replace("\\", "/") for p in args.files}
        files = [f for f in files if f[0] in keep]
        missing = keep - {f[0] for f in files}
        if missing:
            raise SystemExit("这些路径在项目里找不到：%s" % ", ".join(sorted(missing)))
    total = sum(os.path.getsize(f) for _, f in files)
    print("[1/4] 待上传 %d 个文件，%.1f MB" % (len(files), total / 1048576.0))
    for rel, full in files:
        print("      %8.1f KB  %s" % (os.path.getsize(full) / 1024.0, rel))
    if args.dry_run:
        print("dry-run：到此为止。")
        return

    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("缺少 GH_TOKEN 环境变量（GitHub PAT）。")

    me = req("GET", "/user", token)
    owner = args.owner or me["login"]
    prefix = "/repos/%s/%s" % (owner, args.repo)
    print("[2/4] 身份 %s，目标仓库 %s/%s（%s）" % (me["login"], owner, args.repo, "私有" if args.private else "公开"))

    try:
        repo = req("GET", prefix, token)
        print("      仓库已存在，复用：" + repo["html_url"])
        empty = True
        try:
            req("GET", prefix + "/git/ref/heads/" + args.branch, token)
            empty = False
        except SystemExit:
            empty = True
    except SystemExit:
        repo = req("POST", "/user/repos", token, {
            "name": args.repo,
            "description": args.desc,
            "private": bool(args.private),
            "auto_init": False,
            "has_issues": True,
            "has_wiki": False,
        })
        print("      已新建：" + repo["html_url"])
        empty = True

    if empty:
        # GitHub 的空仓库不接受 git/blobs，先提交一个文件把仓库“点亮”。
        seed = os.path.join(args.root, "README.md")
        if not os.path.exists(seed):
            seed = files[0][1]
        with open(seed, "rb") as f:
            raw = f.read()
        req("PUT", prefix + "/contents/" + os.path.basename(seed), token, {
            "message": "初始化仓库",
            "content": base64.b64encode(raw).decode("ascii"),
        })
        print("      空仓库需要先有一次提交，已用 %s 打底" % os.path.basename(seed))
        empty = False

    print("[3/4] 上传 blob …")
    shas = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for i, (rel, sha, size) in enumerate(pool.map(lambda it: make_blob(args.root, it, token, prefix), files), 1):
            shas.append({"path": rel, "mode": "100644", "type": "blob", "sha": sha})
            print("      %2d/%d %8.1f KB  %s" % (i, len(files), size / 1024.0, rel))

    body = {"tree": sorted(shas, key=lambda x: x["path"])}
    parents = []
    if not empty:
        body["base_tree"] = req("GET", prefix + "/git/trees/" + args.branch, token)["sha"]
        parents = [req("GET", prefix + "/git/ref/heads/" + args.branch, token)["object"]["sha"]]
    tree = req("POST", prefix + "/git/trees", token, body)
    commit = req("POST", prefix + "/git/commits", token, {
        "message": "《鲸选暗线》v2.5：单文件 HTML 解密游戏（正常商城 + S07 归档区暗网）",
        "tree": tree["sha"],
        "parents": parents,
    })

    if empty:
        req("POST", prefix + "/git/refs", token, {"ref": "refs/heads/" + args.branch, "sha": commit["sha"]})
    else:
        req("PATCH", prefix + "/git/refs/heads/" + args.branch, token, {"sha": commit["sha"], "force": False})

    print("[4/4] 完成 %s/commit/%s" % (repo["html_url"], commit["sha"][:10]))
    print("      仓库地址：" + repo["html_url"])


if __name__ == "__main__":
    main()
