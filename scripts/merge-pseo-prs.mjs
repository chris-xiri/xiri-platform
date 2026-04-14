const PAT = process.env.GITHUB_TOKEN;
if (!PAT) { console.error('Set GITHUB_TOKEN env var'); process.exit(1); }
async function merge(pr) {
  const res = await fetch(`https://api.github.com/repos/chris-xiri/xiri-platform/pulls/${pr}/merge`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${PAT}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ merge_method: "squash", commit_title: `[pSEO] Batch content optimizations` })
  });
  const j = await res.json();
  console.log(`PR #${pr}: ${res.status}`, j.message || j.sha?.slice(0,7) || JSON.stringify(j));
}
merge(7).catch(console.error);
