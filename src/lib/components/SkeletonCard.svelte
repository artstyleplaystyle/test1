<article class="card skeleton" aria-hidden="true">
  <div class="image shimmer"></div>
  <div class="body">
    <div class="line sm shimmer"></div>
    <div class="line lg shimmer"></div>
    <div class="line md shimmer"></div>
    <div class="chips">
      <span class="chip shimmer"></span>
      <span class="chip shimmer"></span>
      <span class="chip shimmer"></span>
    </div>
  </div>
</article>

<style>
  .card{width:340px;border-radius:8px;overflow:hidden;background:transparent;box-shadow:0 4px 14px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,0.08)}
  .image{aspect-ratio:4/3; background:#0a0f33}
  .body{background:#fff;padding:14px}
  .line{height:10px;border-radius:6px;background:#e9edff;margin:8px 0}
  .line.sm{width:40%}
  .line.md{width:60%}
  .line.lg{width:80%}
  .chips{display:flex;gap:8px;margin-top:8px}
  .chip{width:56px;height:20px;border-radius:999px;background:#e9edff}
  .shimmer{position:relative;overflow:hidden}
  .shimmer::after{content:"";position:absolute;inset:0;translate:-100% 0;background:linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);animation:sh 1.2s infinite}
  @keyframes sh{100%{translate:100% 0}}
</style>
