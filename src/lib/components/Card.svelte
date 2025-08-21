<script lang="ts">
  import type { CoffeeCard } from '$lib/types';
  export let card: CoffeeCard;
  let loaded = false;
  let imgEl: HTMLImageElement | null = null;
  function onLoad() { loaded = true; }
  function onError() { loaded = true; } // скрыть плейсхолдер даже если ошибка
  $: safeIngredients = Array.isArray(card?.ingredients) ? card.ingredients : [];
  import { onMount } from 'svelte';
  onMount(() => {
    // Если изображение уже прогружено из кеша браузера до навешивания хендлеров
    if (imgEl && imgEl.complete) {
      // дополнительная проверка успеха
      if ((imgEl as any).naturalWidth > 0) loaded = true;
    }
  });
</script>

<article class="card">
  <div class="image">
    {#if !loaded}
      <img class="placeholder" src="/placeholder.svg" alt="загрузка" />
    {/if}
    <img bind:this={imgEl} src={card.image} alt={card.title} on:load={onLoad} on:error={onError} class:show={loaded} />
    <div class="intensifier" aria-hidden="true">{card.title || card.description || 'Coffee'}</div>
  </div>
  <div class="body">
    <h3 class="title">{card.title}</h3>
    <div class="variety">{card.description}</div>
    <div class="notes" role="list">
      {#each safeIngredients as n}
        <span class="chip" role="listitem">{n}</span>
      {/each}
    </div>
  </div>
</article>

<style>
  /* Карточка */
  .card{
    width: 340px;
    border-radius: 8px;
    overflow: hidden;
    background: transparent;
    box-shadow: 0 4px 14px rgba(0,0,0,.35);
    border: 1px solid rgba(255,255,255,0.08);
  }

  /* Изображение */
  .image{position:relative; aspect-ratio: 4/3; background:#0a0f33}
  .image img{width:100%; height:100%; object-fit:cover; display:block}
  .image .placeholder{position:absolute; inset:0; filter:blur(2px); opacity:.9}
  .image img:not(.show){display:none}
  .image .intensifier{
    position:absolute; left:8px; top:8px;
    background:rgba(255,255,255,.9);
    color:#111; font-weight:600; font-size:12px;
    border-radius:999px; padding:4px 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,.2);
    max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* Тело карточки — белый блок */
  .body{background:#fff; padding:14px}
  .title{margin:2px 0 4px; font-size:20px; font-weight:700; color:#1f2430}
  .variety{color:#4b4f66; font-size:14px}

  /* Теги заметок */
  .notes{margin-top:10px; display:flex; gap:8px; overflow:auto; -webkit-overflow-scrolling:touch; scrollbar-width:thin; padding-bottom:6px}
  .notes:focus{outline:2px solid #cdd3ff; outline-offset:2px}
  .chip{background:#eef2ff; border:1px solid #e1e6ff; color:#333a66; font-size:12px; padding:6px 8px; border-radius:999px; white-space:nowrap}
</style>
