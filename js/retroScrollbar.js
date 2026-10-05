// js/retroScrollbar.js
// iOS Safari처럼 ::-webkit-scrollbar 꾸밈을 무시하고 스크롤바를 겹쳐 그리는(폭 0) 환경에서는
// 레트로 스크롤바가 보이지 않는다. 그런 환경에서만 트랙과 손잡이를 직접 그려 같은 모양을 낸다.

let overlayScrollbars = null;

export function usesOverlayScrollbars() {
  if (overlayScrollbars !== null) return overlayScrollbars;
  const probe = document.createElement('div');
  probe.className = 'retro-scroll-probe';
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:50px;overflow-y:scroll;visibility:hidden;';
  probe.appendChild(document.createElement('div')).style.height = '200px';
  document.body.appendChild(probe);
  overlayScrollbars = probe.offsetWidth - probe.clientWidth === 0;
  probe.remove();
  document.documentElement.classList.toggle('uses-retro-scrollbar', overlayScrollbars);
  return overlayScrollbars;
}

// scroller: 실제로 스크롤되는 요소, host: 위아래 화살표 버튼이 들어 있는 기준 요소.
// variant는 화살표와 같은 위치 규칙을 쓰기 위한 이름(css의 .retro-scrollbar-{variant}).
export function attachRetroScrollbar(scroller, host, variant) {
  if (!usesOverlayScrollbars()) return null;
  scroller.retroScrollbar?.destroy();

  const track = document.createElement('div');
  track.className = `retro-scrollbar retro-scrollbar-${variant}`;
  track.setAttribute('aria-hidden', 'true');
  track.hidden = true;
  const thumb = document.createElement('div');
  thumb.className = 'retro-scrollbar-thumb';
  track.appendChild(thumb);
  host.appendChild(track);

  const metrics = () => {
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(24, trackHeight * (scroller.clientHeight / scroller.scrollHeight));
    return { maxScroll, trackHeight, thumbHeight, travel: Math.max(0, trackHeight - thumbHeight) };
  };

  const render = () => {
    if (track.hidden) return;
    const { maxScroll, thumbHeight, travel } = metrics();
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${maxScroll > 0 ? (scroller.scrollTop / maxScroll) * travel : 0}px)`;
  };

  let drag = null;
  thumb.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    drag = { startY: event.clientY, startScroll: scroller.scrollTop };
  });
  thumb.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const { maxScroll, travel } = metrics();
    if (travel <= 0) return;
    scroller.scrollTop = drag.startScroll + ((event.clientY - drag.startY) * maxScroll) / travel;
  });
  const endDrag = () => { drag = null; };
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);

  // 트랙의 빈 곳을 누르면 그 방향으로 한 화면씩 넘긴다.
  track.addEventListener('pointerdown', (event) => {
    if (event.target !== track) return;
    const direction = event.clientY < thumb.getBoundingClientRect().top ? -1 : 1;
    scroller.scrollBy({ top: direction * scroller.clientHeight * 0.9, behavior: 'smooth' });
  });

  scroller.addEventListener('scroll', render, { passive: true });

  const api = {
    update(canScroll) {
      track.hidden = !canScroll;
      render();
    },
    destroy() {
      scroller.removeEventListener('scroll', render);
      track.remove();
      if (scroller.retroScrollbar === api) scroller.retroScrollbar = null;
    },
  };
  scroller.retroScrollbar = api;
  return api;
}
