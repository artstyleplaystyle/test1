<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import SkeletonCard from '$lib/components/SkeletonCard.svelte';
  import type { CoffeeCard, CoffeeType } from '$lib/types';
  import { createIdleTimer } from '$lib/idle';
  import { onMount, onDestroy, tick } from 'svelte';

  export let data: { initial: CoffeeCard | null; type: CoffeeType };
  export let params: Record<string, string>;
  export let form: unknown;

  let currentType: CoffeeType = data.type ?? 'hot';
  let cards: CoffeeCard[] = data.initial ? [data.initial] : [];
  let loading = false;

  async function fetchInitial(t: CoffeeType) {
    const res = await fetch(`/api/initial?type=${t}`);
    if (!res.ok) throw new Error(`initial ${res.status}`);
    const raw = (await res.json()) as any;
    const c: CoffeeCard = {
      id: Number(raw.id ?? 0),
      title: String(raw.title ?? ''),
      description: String(raw.description ?? ''),
      image: String(raw.image ?? ''),
      ingredients: Array.isArray(raw.ingredients)
        ? raw.ingredients.map(String).filter(Boolean)
        : typeof raw.ingredients === 'string'
          ? raw.ingredients.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
    };
    return c;
  }

  async function onTypeChange(t: CoffeeType) {
    if (t === currentType) return;
    currentType = t;
    cards = [];
    loading = true;
    try {
      const c = await fetchInitial(currentType);
      cards = [c];
    } catch (e) {
      console.error('Не удалось загрузить стартовую карточку', e);
    } finally {
      loading = false;
    }
  }

  async function loadNext() {
    if (loading) return;
    loading = true;
    await tick(); // гарантируем, что disabled применится до начала запроса
    try {
      const res = await fetch(`/api/next?type=${currentType}`, { method: 'POST' });
      if (!res.ok) throw new Error(`следующая ${res.status}`);
      const raw = (await res.json()) as any;
      const c: CoffeeCard = {
        id: Number(raw.id ?? 0),
        title: String(raw.title ?? ''),
        description: String(raw.description ?? ''),
        image: String(raw.image ?? ''),
        ingredients: Array.isArray(raw.ingredients)
          ? raw.ingredients.map(String).filter(Boolean)
          : typeof raw.ingredients === 'string'
            ? raw.ingredients.split(',').map((s: string) => s.trim()).filter(Boolean)
            : []
      };
      cards = [...cards, c];
    } catch (e) {
      console.error('Не удалось загрузить следующую карточку', e);
    } finally {
      loading = false;
    }
  }

  const idleTimer = createIdleTimer(30000);
  let unsub: () => void;
  let idleInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    idleTimer.start();
    unsub = idleTimer.idle.subscribe((isIdle) => {
      if (isIdle) {
        void loadNext();
        if (!idleInterval) {
          idleInterval = setInterval(() => {
            if (!loading) void loadNext();
          }, 30000);
        }
      } else {
        if (idleInterval) {
          clearInterval(idleInterval);
          idleInterval = null;
        }
      }
    });
  });
  onDestroy(() => {
    idleTimer.stop();
    unsub?.();
    if (idleInterval) {
      clearInterval(idleInterval);
      idleInterval = null;
    }
  });
</script>

<div class="container" id="app">
  <div class="toolbar" role="tablist" aria-label="Coffee type">
    <button
      class:active={currentType === 'hot'}
      role="tab"
      aria-selected={currentType === 'hot'}
      on:click={() => onTypeChange('hot')}
    >Hot</button>
    <button
      class:active={currentType === 'iced'}
      role="tab"
      aria-selected={currentType === 'iced'}
      on:click={() => onTypeChange('iced')}
    >Iced</button>
  </div>

  <div class="list" aria-live="polite">
    {#each cards as card}
      <div class="item"><Card {card} /></div>
    {/each}
    <button class="fab" on:click={loadNext} disabled={loading} aria-label="Добавить карточку">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
    {#if loading}
      <div class="loading"><SkeletonCard /></div>
    {/if}
  </div>
</div>

<style>
  .toolbar{display:flex; gap:8px; justify-content:center; margin:12px 0}
  .toolbar button{padding:8px 12px; border-radius:999px; border:1px solid rgba(255,255,255,.2); background:#0b122e; color:#dfe4ff; cursor:pointer}
  .toolbar button.active{background:#4f6bff; border-color:#4f6bff; color:#fff}

  .list{display:flex; flex-direction:column; gap:16px; align-items:center}
  .item{animation: fade .25s ease}
  .loading{display:flex; justify-content:center; margin-top:8px}
  @keyframes fade{from{opacity:0; transform: translateY(4px)} to{opacity:1; transform:none}}
</style>
