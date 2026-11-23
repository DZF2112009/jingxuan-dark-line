#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""上传后自检：仓库可见性、文件数量、index.html 与本地是否逐字节一致。"""
import hashlib, json, os, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
TOKEN = os.environ["GH_TOKEN"]
OWNER, REPO = "DZF2112009", "jingxuan-dark-line"
LOCAL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "index.html")


def get(path, raw=False):
    r = urllib.request.Request("https://api.github.com" + path)
    r.add_header("Authorization", "Bearer " + TOKEN)
    r.add_header("Accept", "application/vnd.github.raw" if raw else "application/vnd.github+json")
    r.add_header("User-Agent", "jxl-check")
    with urllib.request.urlopen(r, timeout=120) as resp:
        data = resp.read()
        return data if raw else json.loads(data.decode("utf-8"))


repo = get("/repos/%s/%s" % (OWNER, REPO))
print("仓库 %s | private=%s | 默认分支=%s" % (repo["full_name"], repo["private"], repo["default_branch"]))

root = get("/repos/%s/%s/git/trees/%s?recursive=1" % (OWNER, REPO, repo["default_branch"]))
blobs = [t for t in root["tree"] if t["type"] == "blob"]
print("线上文件数 %d（truncated=%s）" % (len(blobs), root["truncated"]))
for t in sorted(blobs, key=lambda x: x["path"]):
    print("   %8.1f KB  %s" % (t.get("size", 0) / 1024.0, t["path"]))

remote = get("/repos/%s/%s/contents/index.html?ref=%s" % (OWNER, REPO, repo["default_branch"]), raw=True)
local = open(LOCAL, "rb").read()
print("index.html 本地 %d 字节 sha256=%s" % (len(local), hashlib.sha256(local).hexdigest()[:16]))
print("index.html 线上 %d 字节 sha256=%s" % (len(remote), hashlib.sha256(remote).hexdigest()[:16]))
print("逐字节一致：%s" % (remote == local))
