// 禮物寶箱模組 (gift-pack-ui.js)
// 獨立全螢幕彈窗：發光寶箱 -> 逐項禮物跳出（支援 player 攻擊三連動作） -> 領取完畢總覽
(function () {
  if (window.GiftPackModal) return;

  const DEFAULT_OPTIONS = {
    title: '<ruby>神<rt>ㄕㄣˊ</rt></ruby><ruby>秘<rt>ㄇㄧˋ</rt></ruby><ruby>禮<rt>ㄌㄧˇ</rt></ruby><ruby>物<rt>ㄨˋ</rt></ruby>',
    subtitle: '',
    chestImg: '',
    openBtnHtml: '<span>✨</span><span class="zh-text"><ruby>開<rt>ㄎㄞ</rt></ruby><ruby>啟<rt>ㄑㄧˇ</rt></ruby><ruby>寶<rt>ㄅㄠˇ</rt></ruby><ruby>箱<rt>ㄒㄧㄤ</rt></ruby></span>',
    nextBtnHtml: '<span>✨</span><span class="zh-text"><ruby>下<rt>ㄒㄧㄚˋ</rt></ruby><ruby>一<rt>ㄧ</rt></ruby><ruby>個<rt>˙ㄍㄜ</rt></ruby></span>',
    lastItemBtnHtml: '<span>🎁</span><span class="zh-text"><ruby>收<rt>ㄕㄡ</rt></ruby><ruby>下<rt>ㄒㄧㄚˋ</rt></ruby></span>',
    summaryTitle: '<span>🎉 </span><ruby>領<rt>ㄌㄧㄥˇ</rt></ruby><ruby>取<rt>ㄑㄩˇ</rt></ruby><ruby>完<rt>ㄨㄢˊ</rt></ruby><ruby>畢<rt>ㄅㄧˋ</rt></ruby><span>！</span>',
    summarySubtitle: '<ruby>全<rt>ㄑㄩㄢˊ</rt></ruby><ruby>部<rt>ㄅㄨˋ</rt></ruby><ruby>獎<rt>ㄐㄧㄤˇ</rt></ruby><ruby>勵<rt>ㄌㄧˋ</rt></ruby><ruby>都<rt>ㄉㄡ</rt></ruby><ruby>放<rt>ㄈㄤˋ</rt></ruby><ruby>進<rt>ㄐㄧㄣˋ</rt></ruby><ruby>背<rt>ㄅㄟ</rt></ruby><ruby>包<rt>ㄅㄠ</rt></ruby><ruby>囉<rt>ㄌㄨㄛ</rt></ruby><span>！</span>',
    confirmBtnHtml: '<span>✔️</span><span class="zh-text"><ruby>確<rt>ㄑㄩㄝˋ</rt></ruby><ruby>定<rt>ㄉㄧㄥˋ</rt></ruby></span>',
    items: [],
    onOpen: null,
    onItemReveal: null,
    onClaim: null,
    onClose: null
  };

  // 三連攻擊動作節奏：0(待機) 420ms -> 1(蓄力) 180ms -> 2(揮擊) 260ms
  const ATTACK_FRAME_DURATIONS = [420, 180, 260];

  let styleInjected = false;
  let domInjected = false;
  let modalEl = null;
  let contentEl = null;
  let badgeEl = null;
  let fxLayerEl = null;
  let chestPhaseEl = null;
  let chestStageEl = null;
  let chestSvgEl = null;
  let chestImgEl = null;
  let chestInfoBoxEl = null;
  let chestSubtitleEl = null;
  let revealPhaseEl = null;
  let revealDotsEl = null;
  let revealCounterEl = null;
  let itemBoxEl = null;
  let playerStageEl = null;
  let itemImgEl = null;
  let itemIconEl = null;
  let revealInfoBoxEl = null;
  let itemTitleEl = null;
  let itemDescEl = null;
  let summaryPhaseEl = null;
  let summarySubtitleEl = null;
  let summaryGridEl = null;
  let actionBtnEl = null;

  let currentOptions = null;
  let currentPhase = 'idle'; // idle | chest | reveal | summary
  let currentItemIndex = 0;
  let isAnimating = false;
  let hasClaimed = false;
  let isOpenState = false;
  let openTimerId = null;
  let particleTimerId = null;
  let revealAnimTimerId = null;
  let summaryAnimTimers = [];

  function injectStyle() {
    if (styleInjected || document.getElementById('gift-pack-ui-style')) {
      styleInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'gift-pack-ui-style';
    style.textContent = `
      #gift-pack-modal {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100dvh;
        z-index: 10020;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(5, 10, 24, 0.9);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
        padding: 0;
        touch-action: manipulation;
      }

      #gift-pack-modal.active {
        opacity: 1;
        pointer-events: auto;
      }

      #gift-pack-content {
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
        width: 100vw;
        height: 100dvh;
        max-width: 100vw;
        max-height: 100dvh;
        border-radius: 0;
        border: none;
        padding:
          max(env(safe-area-inset-top), 14px)
          max(env(safe-area-inset-right), 16px)
          max(env(safe-area-inset-bottom), 16px)
          max(env(safe-area-inset-left), 16px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        text-align: center;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 44px rgba(251, 191, 36, 0.24);
        position: relative;
        transform: scale(0.94);
        transition: transform 0.26s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      #gift-pack-modal.active #gift-pack-content {
        transform: scale(1);
      }

      @media (min-width: 769px) {
        #gift-pack-modal {
          padding: 20px;
        }
        #gift-pack-content {
          width: min(94vw, 760px);
          height: min(94dvh, 920px);
          max-width: 760px;
          max-height: 920px;
          border-radius: 2.5rem;
          border: 8px solid #64748b;
          padding: 24px 28px 26px 28px;
        }
      }

      .gp-header {
        flex-shrink: 0;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        padding-bottom: 10px;
        position: relative;
        z-index: 20;
      }

      #gp-badge {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #ffffff;
        padding: 10px 28px;
        border-radius: 9999px;
        font-size: clamp(28px, min(7vw, 4.5dvh), 44px);
        font-weight: 900;
        line-height: 1.35;
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45), 0 0 22px rgba(245, 158, 11, 0.55);
        border: 4px solid #fef3c7;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        max-width: 100%;
      }

      .gp-body {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        -webkit-overflow-scrolling: touch;
        position: relative;
        z-index: 10;
      }

      #gift-pack-modal .gp-body,
      #gift-pack-modal .gp-body * {
        touch-action: pan-y;
      }

      #gift-pack-modal #gp-chest-stage,
      #gift-pack-modal #gp-action-btn {
        touch-action: manipulation !important;
      }

      .gp-footer {
        flex-shrink: 0;
        width: 100%;
        padding-top: 12px;
        position: relative;
        z-index: 20;
      }

      #gp-fx-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 30;
        border-radius: inherit;
      }

      .gp-spark-particle {
        position: absolute;
        left: 50%;
        top: 44%;
        font-size: 34px;
        line-height: 1;
        pointer-events: none;
        animation: gp-burst 0.78s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes gp-burst {
        0% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(0.45) rotate(0deg);
        }
        75% {
          opacity: 1;
        }
        100% {
          opacity: 0;
          transform: translate(calc(-50% + var(--tx, 0px)), calc(-50% + var(--ty, -100px))) scale(1.25) rotate(var(--rot, 120deg));
        }
      }

      .gp-phase {
        display: none;
        flex-direction: column;
        align-items: center;
        width: 100%;
        margin: auto 0;
        position: relative;
        z-index: 10;
      }

      .gp-phase.active {
        display: flex;
      }

      /* ===== Phase 1: 發光寶箱 ===== */
      #gp-chest-stage {
        position: relative;
        width: clamp(170px, min(62vw, 36dvh), 380px);
        height: clamp(170px, min(62vw, 36dvh), 380px);
        margin: 6px auto 14px auto;
        border-radius: 2.8rem;
        background: radial-gradient(circle, rgba(251, 191, 36, 0.28) 0%, #1e293b 72%);
        border: 7px solid #f59e0b;
        box-shadow: 0 0 44px rgba(251, 191, 36, 0.55), inset 0 4px 18px rgba(254, 243, 199, 0.28);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        overflow: hidden;
      }

      .gp-rotating-rays {
        position: absolute;
        inset: -35%;
        background: repeating-conic-gradient(
          from 0deg,
          rgba(253, 224, 71, 0.38) 0deg 14deg,
          rgba(253, 224, 71, 0) 14deg 30deg
        );
        animation: gp-spin-slow 9s linear infinite;
        pointer-events: none;
      }

      @keyframes gp-spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .gp-glow-core {
        position: absolute;
        inset: 12%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(254, 240, 138, 0.75) 0%, rgba(251, 191, 36, 0) 72%);
        animation: gp-pulse 1.8s ease-in-out infinite;
        pointer-events: none;
      }

      @keyframes gp-pulse {
        0%, 100% { transform: scale(0.95); opacity: 0.78; }
        50% { transform: scale(1.14); opacity: 1; }
      }

      #gp-chest-svg {
        position: relative;
        z-index: 5;
        width: 82%;
        height: 82%;
        filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.58));
        animation: gp-chest-wobble 2.1s ease-in-out infinite;
        transform-origin: center bottom;
        pointer-events: none;
      }

      #gp-chest-svg .gp-chest-lid {
        transform-box: fill-box;
        transform-origin: 50% 85%;
        transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      #gp-chest-stage.is-opening #gp-chest-svg {
        animation: gp-chest-open-pop 0.42s ease forwards;
      }

      #gp-chest-stage.is-opening #gp-chest-svg .gp-chest-lid {
        transform: translateY(-16px) rotate(-18deg) scale(1.04);
      }

      #gp-chest-stage.is-opening .gp-glow-core {
        transform: scale(1.65);
        opacity: 1;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.96) 0%, rgba(253, 224, 71, 0.78) 55%, rgba(251, 191, 36, 0) 80%);
      }

      #gp-chest-img {
        position: relative;
        z-index: 5;
        width: 82%;
        height: 82%;
        object-fit: contain;
        display: none;
        filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.58));
        animation: gp-chest-wobble 2.1s ease-in-out infinite;
        pointer-events: none;
      }

      #gp-chest-stage.is-opening #gp-chest-img {
        animation: gp-chest-open-pop 0.42s ease forwards;
      }

      @keyframes gp-chest-wobble {
        0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
        25% { transform: translateY(-6px) rotate(-2.5deg) scale(1.02); }
        50% { transform: translateY(0) rotate(0deg) scale(1); }
        75% { transform: translateY(-6px) rotate(2.5deg) scale(1.02); }
      }

      @keyframes gp-chest-open-pop {
        0% { transform: scale(1); }
        40% { transform: scale(1.16, 0.88); }
        100% { transform: scale(1.12); }
      }

      .gp-info-box {
        width: 100%;
        background-color: #334155;
        border-radius: 1.6rem;
        padding: 16px 20px;
        margin-top: 4px;
        border: 3px solid #64748b;
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25);
      }

      #gp-chest-subtitle {
        color: #fef3c7;
        font-weight: 800;
        font-size: clamp(28px, min(7vw, 4.5dvh), 44px);
        line-height: 1.45;
      }

      /* ===== Phase 2: 逐項展示禮物 ===== */
      .gp-progress-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }

      #gp-reveal-dots {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }

      .gp-dot {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: #475569;
        border: 2px solid #94a3b8;
        transition: all 0.2s ease;
      }

      .gp-dot.done {
        background: #10b981;
        border-color: #a7f3d0;
      }

      .gp-dot.current {
        width: 30px;
        background: #fbbf24;
        border-color: #fef3c7;
        box-shadow: 0 0 12px rgba(251, 191, 36, 0.85);
      }

      #gp-reveal-counter {
        font-size: clamp(20px, 4.8vw, 26px);
        font-weight: 900;
        color: #e2e8f0;
        background: rgba(15, 23, 42, 0.72);
        padding: 4px 16px;
        border-radius: 999px;
        border: 2px solid #475569;
      }

      #gp-item-box {
        position: relative;
        width: clamp(170px, min(62vw, 36dvh), 380px);
        height: clamp(170px, min(62vw, 36dvh), 380px);
        margin: 8px auto 16px auto;
        background-color: #334155;
        border-radius: 2.6rem;
        border: 8px solid #64748b;
        box-shadow: 0 0 34px rgba(253, 230, 138, 0.3), inset 0 4px 12px rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      #gp-item-box.is-player-box {
        border-color: #c084fc;
        background: radial-gradient(circle, rgba(168, 85, 247, 0.24) 0%, #334155 75%);
        box-shadow: 0 0 42px rgba(192, 132, 252, 0.55), inset 0 4px 16px rgba(255, 255, 255, 0.14);
      }

      #gp-item-box.is-sticker-box {
        border-color: #38bdf8;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, #334155 75%);
        box-shadow: 0 0 32px rgba(56, 189, 248, 0.35), inset 0 4px 14px rgba(0, 0, 0, 0.4);
      }

      #gp-item-box.is-sticker-box #gp-item-img {
        filter:
          drop-shadow(2px 0 0 rgba(255, 255, 255, 0.92))
          drop-shadow(-2px 0 0 rgba(255, 255, 255, 0.92))
          drop-shadow(0 2px 0 rgba(255, 255, 255, 0.92))
          drop-shadow(0 -2px 0 rgba(255, 255, 255, 0.92))
          drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
      }

      #gp-item-box.pop-in {
        animation: gp-jelly-in 0.48s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      @keyframes gp-jelly-in {
        0% { transform: scale(0.42); opacity: 0; }
        60% { transform: scale(1.08); opacity: 1; }
        82% { transform: scale(0.96); }
        100% { transform: scale(1); }
      }

      #gp-player-stage {
        position: relative;
        width: 86%;
        height: 86%;
        z-index: 6;
        display: none;
      }

      .gp-player-stage {
        position: relative;
        width: 86%;
        height: 86%;
      }

      .gp-player-frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0;
        transition: transform 0.12s ease;
        filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.55));
        pointer-events: none;
      }

      .gp-player-frame.active {
        opacity: 1;
      }

      .gp-player-frame.is-strike.active {
        transform: translateX(6px) scale(1.05);
      }

      #gp-item-img {
        width: 86%;
        height: 86%;
        object-fit: contain;
        position: relative;
        z-index: 6;
        display: none;
        filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
      }

      #gp-item-icon {
        font-size: clamp(104px, min(28vw, 18dvh), 184px);
        position: relative;
        z-index: 6;
        display: none;
        line-height: 1;
        filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
      }

      #gp-item-title {
        color: #fde68a;
        font-weight: 900;
        font-size: clamp(32px, min(8vw, 5.2dvh), 48px);
        line-height: 1.45;
      }

      #gp-item-desc {
        color: #e2e8f0;
        font-weight: 700;
        font-size: clamp(22px, min(5.5vw, 3.6dvh), 32px);
        line-height: 1.5;
        margin-top: 8px;
        display: none;
      }

      /* ===== Phase 3: 領取完畢總覽 ===== */
      #gp-summary-subtitle {
        color: #fef3c7;
        font-weight: 800;
        font-size: clamp(24px, min(6vw, 3.8dvh), 34px);
        line-height: 1.45;
        margin-bottom: 14px;
      }

      #gp-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        width: 100%;
      }

      .gp-summary-card {
        background: #334155;
        border: 3px solid #64748b;
        border-radius: 1.4rem;
        padding: 16px 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.38);
        animation: gp-jelly-in 0.36s ease backwards;
      }

      .gp-summary-card.is-player-card {
        border-color: #c084fc;
        background: linear-gradient(180deg, #3b2d54 0%, #334155 100%);
      }

      .gp-summary-card.is-sticker-card {
        border-color: #38bdf8;
      }

      .gp-summary-thumb {
        width: 136px;
        height: 136px;
        flex-shrink: 0;
        border-radius: 1.2rem;
        background: #1e293b;
        border: 3px solid #475569;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .gp-summary-thumb img {
        width: 84%;
        height: 84%;
        object-fit: contain;
      }

      .gp-summary-thumb .gp-player-stage {
        width: 86%;
        height: 86%;
      }

      .gp-summary-thumb .gp-player-frame {
        width: 100%;
        height: 100%;
      }

      .gp-summary-thumb-icon {
        font-size: 68px;
        line-height: 1;
      }

      .gp-summary-name {
        color: #fde68a;
        font-size: clamp(26px, 3.2vw, 34px);
        font-weight: 900;
        line-height: 1.4;
      }

      @media (max-width: 600px) {
        #gp-summary-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .gp-summary-card {
          flex-direction: row;
          justify-content: flex-start;
          padding: 12px 16px;
          gap: 16px;
          text-align: left;
        }
        .gp-summary-thumb {
          width: 96px;
          height: 96px;
        }
        .gp-summary-thumb-icon {
          font-size: 52px;
        }
        .gp-summary-name {
          font-size: clamp(26px, 6.6vw, 34px);
          flex: 1;
          min-width: 0;
        }
        .gp-summary-name .zh-text {
          justify-content: flex-start;
        }
      }

      /* ===== 底部主要操作按鈕 ===== */
      #gp-action-btn {
        width: 100%;
        background-color: #10b981;
        color: #ffffff;
        font-weight: 900;
        font-size: clamp(28px, min(7vw, 4.5dvh), 42px);
        line-height: 1.3;
        padding: clamp(14px, 2.2dvh, 20px) 24px;
        border-radius: 1.4rem;
        border: 4px solid #a7f3d0;
        box-shadow: 0 8px 22px rgba(16, 185, 129, 0.5);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        transition: transform 0.1s ease, background-color 0.15s ease;
        position: relative;
        z-index: 15;
      }

      #gp-action-btn > * {
        pointer-events: none;
      }

      #gp-action-btn.is-chest-btn {
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
        border-color: #fef08a;
        box-shadow: 0 8px 24px rgba(245, 158, 11, 0.55);
      }

      #gp-action-btn:active {
        transform: scale(0.95);
      }

      /* ===== 注音放大與間距調整 ===== */
      #gift-pack-modal .zh-text {
        line-height: 1.55;
        padding-top: 0.12em;
      }
      #gift-pack-modal .char-block {
        margin-right: 0.65em;
        margin-bottom: 6px;
      }
      #gift-pack-modal .bopo {
        font-size: 0.44em;
        font-weight: 900;
        margin-left: 4px;
        letter-spacing: 0px;
        line-height: 1.08;
        color: #fde047;
      }
      #gift-pack-modal .gp-summary-name .char-block {
        margin-right: 0.52em;
        margin-bottom: 4px;
      }

      /* 橫向短螢幕優化（如 667x375），放在最後確保正確覆寫按鈕與字體大小 */
      @media (max-height: 550px) {
        #gift-pack-content {
          padding:
            max(env(safe-area-inset-top), 8px)
            max(env(safe-area-inset-right), 14px)
            max(env(safe-area-inset-bottom), 10px)
            max(env(safe-area-inset-left), 14px);
        }
        .gp-header {
          padding-bottom: 6px;
        }
        #gp-badge {
          font-size: clamp(22px, 5.8dvh, 28px);
          padding: 6px 20px;
          border-width: 3px;
        }
        #gp-chest-stage,
        #gp-item-box {
          width: clamp(112px, 31dvh, 170px);
          height: clamp(112px, 31dvh, 170px);
          margin: 4px auto 8px auto;
          border-radius: 1.6rem;
          border-width: 5px;
        }
        #gp-item-icon {
          font-size: clamp(64px, 19dvh, 100px);
        }
        .gp-progress-row {
          margin-bottom: 6px;
        }
        #gp-reveal-counter {
          font-size: 16px;
          padding: 2px 12px;
        }
        .gp-info-box {
          padding: 8px 14px;
          border-radius: 1.1rem;
        }
        #gp-chest-subtitle,
        #gp-item-title {
          font-size: clamp(22px, 5.8dvh, 32px);
        }
        #gp-item-desc {
          font-size: clamp(16px, 4.2dvh, 22px);
        }
        #gp-summary-grid {
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }
        .gp-summary-card {
          flex-direction: column;
          justify-content: center;
          text-align: center;
          padding: 10px 8px;
          gap: 6px;
        }
        .gp-summary-thumb {
          width: 72px;
          height: 72px;
        }
        .gp-summary-thumb-icon {
          font-size: 40px;
        }
        .gp-summary-name {
          font-size: clamp(21px, 5.6dvh, 28px);
        }
        .gp-summary-name .zh-text {
          justify-content: center;
        }
        .gp-footer {
          padding-top: 8px;
        }
        #gp-action-btn {
          font-size: clamp(21px, 5.6dvh, 28px);
          padding: 8px 18px;
        }
      }
    `;
    document.head.appendChild(style);
    styleInjected = true;
  }

  function buildChestSvg() {
    return `
      <svg id="gp-chest-svg" viewBox="0 0 200 180" aria-hidden="true">
        <defs>
          <linearGradient id="gp-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c26d27"/>
            <stop offset="100%" stop-color="#7c3a11"/>
          </linearGradient>
          <linearGradient id="gp-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
        </defs>
        <!-- 寶箱底座 -->
        <rect x="26" y="84" width="148" height="72" rx="14" fill="url(#gp-wood)" stroke="#fef08a" stroke-width="5"/>
        <rect x="44" y="84" width="16" height="72" fill="url(#gp-gold)"/>
        <rect x="140" y="84" width="16" height="72" fill="url(#gp-gold)"/>
        <rect x="26" y="138" width="148" height="12" rx="4" fill="#5c280a" opacity="0.45"/>

        <!-- 寶箱上蓋 -->
        <g class="gp-chest-lid">
          <path d="M22 86 C22 42, 48 28, 100 28 C152 28, 178 42, 178 86 Z" fill="url(#gp-wood)" stroke="#fef08a" stroke-width="5"/>
          <path d="M44 38 L60 35 L60 86 L44 86 Z" fill="url(#gp-gold)"/>
          <path d="M140 35 L156 38 L156 86 L140 86 Z" fill="url(#gp-gold)"/>
          <rect x="20" y="76" width="160" height="15" rx="6" fill="url(#gp-gold)" stroke="#fffbeb" stroke-width="2"/>
          <!-- 中央金色鎖扣 -->
          <rect x="84" y="70" width="32" height="34" rx="8" fill="url(#gp-gold)" stroke="#fffbeb" stroke-width="3"/>
          <circle cx="100" cy="84" r="5" fill="#7c2d12"/>
          <rect x="97" y="85" width="6" height="11" rx="2" fill="#7c2d12"/>
        </g>

        <!-- 閃亮星星裝飾 -->
        <text x="20" y="34" font-size="22">✨</text>
        <text x="160" y="36" font-size="22">✨</text>
      </svg>
    `;
  }

  function ensureInitialized() {
    injectStyle();
    if (domInjected && modalEl) return;
    if (!document.body) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'gift-pack-modal';
    wrapper.innerHTML = `
      <div id="gift-pack-content" role="dialog" aria-modal="true">
        <div id="gp-fx-layer"></div>

        <div class="gp-header">
          <div id="gp-badge" class="zh-text"></div>
        </div>

        <div class="gp-body">
          <!-- Phase 1: 發光寶箱 -->
          <div id="gp-phase-chest" class="gp-phase">
            <div id="gp-chest-stage" title="點擊開啟寶箱">
              <div class="gp-rotating-rays"></div>
              <div class="gp-glow-core"></div>
              ${buildChestSvg()}
              <img id="gp-chest-img" src="" alt="treasure chest">
            </div>
            <div id="gp-chest-info-box" class="gp-info-box">
              <div id="gp-chest-subtitle" class="zh-text"></div>
            </div>
          </div>

          <!-- Phase 2: 逐項禮物跳出 -->
          <div id="gp-phase-reveal" class="gp-phase">
            <div class="gp-progress-row">
              <div id="gp-reveal-dots"></div>
              <div id="gp-reveal-counter" class="zh-text"></div>
            </div>
            <div id="gp-item-box">
              <div class="gp-rotating-rays"></div>
              <div class="gp-glow-core"></div>
              <div id="gp-player-stage"></div>
              <img id="gp-item-img" src="" alt="reward">
              <div id="gp-item-icon">🎁</div>
            </div>
            <div id="gp-reveal-info-box" class="gp-info-box">
              <div id="gp-item-title" class="zh-text"></div>
              <div id="gp-item-desc" class="zh-text"></div>
            </div>
          </div>

          <!-- Phase 3: 領取完畢總覽 -->
          <div id="gp-phase-summary" class="gp-phase">
            <div id="gp-summary-subtitle" class="zh-text"></div>
            <div id="gp-summary-grid"></div>
          </div>
        </div>

        <div class="gp-footer">
          <button id="gp-action-btn" type="button"></button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
    modalEl = wrapper;
    contentEl = document.getElementById('gift-pack-content');
    badgeEl = document.getElementById('gp-badge');
    fxLayerEl = document.getElementById('gp-fx-layer');
    chestPhaseEl = document.getElementById('gp-phase-chest');
    chestStageEl = document.getElementById('gp-chest-stage');
    chestSvgEl = document.getElementById('gp-chest-svg');
    chestImgEl = document.getElementById('gp-chest-img');
    chestInfoBoxEl = document.getElementById('gp-chest-info-box');
    chestSubtitleEl = document.getElementById('gp-chest-subtitle');
    revealPhaseEl = document.getElementById('gp-phase-reveal');
    revealDotsEl = document.getElementById('gp-reveal-dots');
    revealCounterEl = document.getElementById('gp-reveal-counter');
    itemBoxEl = document.getElementById('gp-item-box');
    playerStageEl = document.getElementById('gp-player-stage');
    itemImgEl = document.getElementById('gp-item-img');
    itemIconEl = document.getElementById('gp-item-icon');
    revealInfoBoxEl = document.getElementById('gp-reveal-info-box');
    itemTitleEl = document.getElementById('gp-item-title');
    itemDescEl = document.getElementById('gp-item-desc');
    summaryPhaseEl = document.getElementById('gp-phase-summary');
    summarySubtitleEl = document.getElementById('gp-summary-subtitle');
    summaryGridEl = document.getElementById('gp-summary-grid');
    actionBtnEl = document.getElementById('gp-action-btn');

    chestStageEl.addEventListener('click', handleAction);
    actionBtnEl.addEventListener('click', handleAction);

    domInjected = true;
  }

  function renderBopomofo() {
    if (window.Bopomofo && typeof window.Bopomofo.render === 'function') {
      window.Bopomofo.render();
    }
  }

  function isPlayerItem(item) {
    return !!(item && (item.type === 'player' || item.type === 'character'));
  }

  function resolvePlayerFrames(item) {
    if (!item) return [];
    if (Array.isArray(item.frames) && item.frames.length > 0) {
      return item.frames.slice();
    }
    const pid = item.playerId || item.charId || '';
    if (!pid) {
      return item.img ? [item.img] : [];
    }
    const charDef = (typeof PLAYER_CHARACTERS !== 'undefined' && PLAYER_CHARACTERS[pid]) ? PLAYER_CHARACTERS[pid] : null;
    const prefix = (charDef && charDef.prefix) ? charDef.prefix : pid;
    const basePath = prefix.startsWith('../')
      ? ('assets/' + prefix.slice(3))
      : ('assets/player/' + prefix);
    return [
      `${basePath}-1.webp`,
      `${basePath}-2.webp`,
      `${basePath}-3.webp`
    ];
  }

  function stopPlayerAnimations() {
    if (revealAnimTimerId) {
      clearTimeout(revealAnimTimerId);
      revealAnimTimerId = null;
    }
    for (let i = 0; i < summaryAnimTimers.length; i++) {
      clearTimeout(summaryAnimTimers[i]);
    }
    summaryAnimTimers = [];
  }

  // 在目標容器建立三連圖堆疊層並重複播放攻擊動作
  function mountPlayerAttackLoop(stageEl, frames, onAllFailed, registerTimer) {
    stageEl.innerHTML = '';
    const imgEls = [];
    const failed = frames.map(() => false);
    let activeIdx = 0;
    let disposed = false;

    const getNextValidIndex = (fromIdx) => {
      for (let step = 1; step <= frames.length; step++) {
        const cand = (fromIdx + step) % frames.length;
        if (!failed[cand]) return cand;
      }
      return -1;
    };

    const setActiveFrame = (idx) => {
      activeIdx = idx;
      for (let i = 0; i < imgEls.length; i++) {
        imgEls[i].classList.toggle('active', i === idx);
      }
    };

    frames.forEach((src, idx) => {
      const img = document.createElement('img');
      img.className = 'gp-player-frame' + (idx === frames.length - 1 ? ' is-strike' : '') + (idx === 0 ? ' active' : '');
      img.alt = '';
      img.src = src;
      img.onerror = () => {
        failed[idx] = true;
        if (failed.every(Boolean)) {
          disposed = true;
          if (typeof onAllFailed === 'function') onAllFailed();
          return;
        }
        if (activeIdx === idx) {
          const next = getNextValidIndex(idx);
          if (next !== -1) setActiveFrame(next);
        }
      };
      imgEls.push(img);
      stageEl.appendChild(img);
    });

    if (frames.length <= 1) return;

    const scheduleNext = () => {
      if (disposed || !stageEl.isConnected) return;
      const delay = ATTACK_FRAME_DURATIONS[activeIdx] || 280;
      const tid = setTimeout(() => {
        if (disposed || !stageEl.isConnected) return;
        const nextIdx = getNextValidIndex(activeIdx);
        if (nextIdx !== -1) {
          setActiveFrame(nextIdx);
        }
        scheduleNext();
      }, delay);
      registerTimer(tid);
    };

    scheduleNext();
  }

  function spawnSparkles(count) {
    if (!fxLayerEl) return;
    fxLayerEl.innerHTML = '';
    const symbols = ['✨', '⭐', '🌟', '🎉', '💫'];
    const total = count || 14;
    for (let i = 0; i < total; i++) {
      const span = document.createElement('span');
      span.className = 'gp-spark-particle';
      span.textContent = symbols[i % symbols.length];
      const angle = (Math.PI * 2 * i) / total + (Math.random() - 0.5) * 0.4;
      const dist = 80 + Math.random() * 140;
      const tx = Math.round(Math.cos(angle) * dist);
      const ty = Math.round(Math.sin(angle) * dist - 20);
      const rot = Math.round((Math.random() - 0.5) * 240);
      span.style.setProperty('--tx', tx + 'px');
      span.style.setProperty('--ty', ty + 'px');
      span.style.setProperty('--rot', rot + 'deg');
      span.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
      fxLayerEl.appendChild(span);
    }
    if (particleTimerId) clearTimeout(particleTimerId);
    particleTimerId = setTimeout(() => {
      if (fxLayerEl) fxLayerEl.innerHTML = '';
      particleTimerId = null;
    }, 850);
  }

  function setPhaseVisibility(phase) {
    currentPhase = phase;
    chestPhaseEl.classList.toggle('active', phase === 'chest');
    revealPhaseEl.classList.toggle('active', phase === 'reveal');
    summaryPhaseEl.classList.toggle('active', phase === 'summary');
    actionBtnEl.classList.toggle('is-chest-btn', phase === 'chest');
  }

  function showChestPhase() {
    stopPlayerAnimations();
    setPhaseVisibility('chest');
    chestStageEl.classList.remove('is-opening');

    if (currentOptions.chestImg) {
      chestSvgEl.style.display = 'none';
      chestImgEl.src = currentOptions.chestImg;
      chestImgEl.style.display = 'block';
      chestImgEl.onerror = () => {
        chestImgEl.style.display = 'none';
        chestSvgEl.style.display = 'block';
      };
    } else {
      chestImgEl.style.display = 'none';
      chestSvgEl.style.display = 'block';
    }

    badgeEl.innerHTML = currentOptions.title;
    if (currentOptions.subtitle) {
      chestSubtitleEl.innerHTML = currentOptions.subtitle;
      chestInfoBoxEl.style.display = 'block';
    } else {
      chestSubtitleEl.innerHTML = '';
      chestInfoBoxEl.style.display = 'none';
    }
    actionBtnEl.innerHTML = currentOptions.openBtnHtml;
    const bodyEl = contentEl && contentEl.querySelector('.gp-body');
    if (bodyEl) bodyEl.scrollTop = 0;
    renderBopomofo();
  }

  function showStaticOrIcon(item) {
    playerStageEl.style.display = 'none';
    playerStageEl.innerHTML = '';
    if (item.img) {
      itemImgEl.src = item.img;
      itemImgEl.style.display = 'block';
      itemIconEl.style.display = 'none';
      itemImgEl.onerror = () => {
        itemImgEl.style.display = 'none';
        itemIconEl.textContent = item.icon || '🎁';
        itemIconEl.style.display = 'block';
      };
    } else {
      itemImgEl.style.display = 'none';
      itemIconEl.textContent = item.icon || '🎁';
      itemIconEl.style.display = 'block';
    }
  }

  function showRevealItem(index) {
    stopPlayerAnimations();

    const items = currentOptions.items;
    if (!items || index >= items.length) {
      showSummaryPhase();
      return;
    }

    currentItemIndex = index;
    setPhaseVisibility('reveal');

    const item = items[index] || {};
    badgeEl.innerHTML = item.badge || currentOptions.title;

    // 進度點與計數
    revealDotsEl.innerHTML = '';
    for (let i = 0; i < items.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'gp-dot' + (i < index ? ' done' : (i === index ? ' current' : ''));
      revealDotsEl.appendChild(dot);
    }
    revealCounterEl.innerHTML = ` ${index + 1} / ${items.length} `;

    // 依獎勵型態切換展示框視覺（人物動態 vs 貼紙靜態）
    const isPlayer = isPlayerItem(item);
    itemBoxEl.classList.toggle('is-player-box', isPlayer);
    itemBoxEl.classList.toggle('is-sticker-box', item.type === 'sticker');

    // 果凍彈跳重新觸發
    itemBoxEl.classList.remove('pop-in');
    void itemBoxEl.offsetWidth;
    itemBoxEl.classList.add('pop-in');

    if (isPlayer) {
      const frames = resolvePlayerFrames(item);
      if (frames.length > 0) {
        itemImgEl.style.display = 'none';
        itemIconEl.style.display = 'none';
        playerStageEl.style.display = 'block';
        mountPlayerAttackLoop(
          playerStageEl,
          frames,
          () => showStaticOrIcon(item),
          (tid) => { revealAnimTimerId = tid; }
        );
      } else {
        showStaticOrIcon(item);
      }
    } else {
      showStaticOrIcon(item);
    }

    const hasTitle = Boolean(item.title);
    const hasDesc = Boolean(item.desc);
    itemTitleEl.innerHTML = item.title || '';
    itemTitleEl.style.display = hasTitle ? 'block' : 'none';
    if (hasDesc) {
      itemDescEl.innerHTML = item.desc;
      itemDescEl.style.display = 'block';
    } else {
      itemDescEl.innerHTML = '';
      itemDescEl.style.display = 'none';
    }
    revealInfoBoxEl.style.display = (hasTitle || hasDesc) ? 'block' : 'none';

    const isLast = index >= items.length - 1;
    actionBtnEl.innerHTML = isLast ? currentOptions.lastItemBtnHtml : currentOptions.nextBtnHtml;

    const bodyEl = contentEl && contentEl.querySelector('.gp-body');
    if (bodyEl) bodyEl.scrollTop = 0;

    spawnSparkles(12);
    renderBopomofo();

    if (typeof currentOptions.onItemReveal === 'function') {
      currentOptions.onItemReveal(item, index, items.length);
    }
  }

  function triggerClaimOnce() {
    if (hasClaimed || !currentOptions) return;
    hasClaimed = true;
    if (typeof currentOptions.onClaim === 'function') {
      currentOptions.onClaim(currentOptions.items || []);
    }
  }

  function showSummaryPhase() {
    stopPlayerAnimations();
    setPhaseVisibility('summary');
    triggerClaimOnce();

    badgeEl.innerHTML = currentOptions.summaryTitle;
    if (currentOptions.summarySubtitle) {
      summarySubtitleEl.innerHTML = currentOptions.summarySubtitle;
      summarySubtitleEl.style.display = 'block';
    } else {
      summarySubtitleEl.innerHTML = '';
      summarySubtitleEl.style.display = 'none';
    }

    const items = currentOptions.items || [];
    summaryGridEl.innerHTML = '';

    items.forEach((item, idx) => {
      const isPlayer = isPlayerItem(item);
      const card = document.createElement('div');
      card.className = 'gp-summary-card'
        + (isPlayer ? ' is-player-card' : '')
        + (item.type === 'sticker' ? ' is-sticker-card' : '');
      card.style.animationDelay = (idx * 0.06).toFixed(2) + 's';

      const thumb = document.createElement('div');
      thumb.className = 'gp-summary-thumb';

      const appendFallbackThumb = () => {
        thumb.innerHTML = '';
        if (item.img) {
          const img = document.createElement('img');
          img.src = item.img;
          img.alt = '';
          img.onerror = () => {
            thumb.innerHTML = '';
            const iconFallback = document.createElement('span');
            iconFallback.className = 'gp-summary-thumb-icon';
            iconFallback.textContent = item.icon || '🎁';
            thumb.appendChild(iconFallback);
          };
          thumb.appendChild(img);
        } else {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'gp-summary-thumb-icon';
          iconSpan.textContent = item.icon || '🎁';
          thumb.appendChild(iconSpan);
        }
      };

      if (isPlayer) {
        const frames = resolvePlayerFrames(item);
        if (frames.length > 0) {
          const miniStage = document.createElement('div');
          miniStage.className = 'gp-player-stage';
          thumb.appendChild(miniStage);
          // 需在 card 插入 DOM 後再啟動，避免 isConnected 為 false
          card.dataset.hasPlayerStage = '1';
          card._miniStage = miniStage;
          card._frames = frames;
          card._fallback = appendFallbackThumb;
        } else {
          appendFallbackThumb();
        }
      } else {
        appendFallbackThumb();
      }

      const name = document.createElement('div');
      name.className = 'gp-summary-name zh-text';
      name.innerHTML = item.title || item.badge || '';

      card.appendChild(thumb);
      card.appendChild(name);
      summaryGridEl.appendChild(card);

      if (card.dataset.hasPlayerStage === '1') {
        mountPlayerAttackLoop(
          card._miniStage,
          card._frames,
          card._fallback,
          (tid) => { summaryAnimTimers.push(tid); }
        );
      }
    });

    actionBtnEl.innerHTML = currentOptions.confirmBtnHtml;
    const bodyEl = contentEl && contentEl.querySelector('.gp-body');
    if (bodyEl) bodyEl.scrollTop = 0;

    spawnSparkles(18);
    renderBopomofo();
  }

  function handleAction() {
    if (!isOpenState || isAnimating || !currentOptions) return;

    if (currentPhase === 'chest') {
      isAnimating = true;
      chestStageEl.classList.add('is-opening');
      spawnSparkles(18);

      if (openTimerId) clearTimeout(openTimerId);
      openTimerId = setTimeout(() => {
        openTimerId = null;
        isAnimating = false;
        if (!isOpenState) return;
        if (currentOptions.items && currentOptions.items.length > 0) {
          showRevealItem(0);
        } else {
          showSummaryPhase();
        }
      }, 420);
      return;
    }

    if (currentPhase === 'reveal') {
      const nextIndex = currentItemIndex + 1;
      if (currentOptions.items && nextIndex < currentOptions.items.length) {
        showRevealItem(nextIndex);
      } else {
        showSummaryPhase();
      }
      return;
    }

    if (currentPhase === 'summary') {
      close();
    }
  }

  function show(options) {
    ensureInitialized();
    if (!modalEl) return;

    stopPlayerAnimations();
    if (openTimerId) {
      clearTimeout(openTimerId);
      openTimerId = null;
    }
    if (particleTimerId) {
      clearTimeout(particleTimerId);
      particleTimerId = null;
    }

    const opts = options || {};
    currentOptions = {
      ...DEFAULT_OPTIONS,
      ...opts,
      items: Array.isArray(opts.items) ? opts.items.slice() : []
    };
    currentItemIndex = 0;
    isAnimating = false;
    hasClaimed = false;
    isOpenState = true;

    if (typeof currentOptions.onOpen === 'function') {
      currentOptions.onOpen();
    }

    showChestPhase();
    modalEl.classList.add('active');
  }

  function close() {
    if (!isOpenState) return;

    stopPlayerAnimations();
    if (openTimerId) {
      clearTimeout(openTimerId);
      openTimerId = null;
    }
    if (particleTimerId) {
      clearTimeout(particleTimerId);
      particleTimerId = null;
    }

    isOpenState = false;
    isAnimating = false;
    currentPhase = 'idle';

    if (playerStageEl) {
      playerStageEl.innerHTML = '';
      playerStageEl.style.display = 'none';
    }
    if (modalEl) modalEl.classList.remove('active');
    if (fxLayerEl) fxLayerEl.innerHTML = '';

    const onCloseCb = currentOptions && currentOptions.onClose;
    currentOptions = null;

    if (typeof onCloseCb === 'function') {
      onCloseCb();
    }
  }

  window.GiftPackModal = {
    show: show,
    close: close,
    isOpen: function () {
      return isOpenState;
    }
  };
})();
