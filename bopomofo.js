/**
 * 貝貝專用注音模組 (bopomofo.js)
 */
(function () {
  // 1. 自動注入修正後的注音排版 CSS
  const style = document.createElement('style');
  style.id = 'bopo-module-style';
  style.textContent = `
    /* 字元主容器 */
    .char-block {
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      margin-right: 0.55em;
      margin-bottom: 4px;
      vertical-align: middle;
      line-height: 1;
    }

    /* 注音本體：直書垂直排列 */
    .bopo {
      writing-mode: vertical-rl;
      text-orientation: upright;
      font-size: 0.35em;
      color: #ffeb3b;
      margin-left: 2px;
      position: relative;
      padding: 0;
      line-height: 1.1;
      letter-spacing: -1px;
    }

    /* 一般聲調（ˊ ˇ ˋ）：靠右置中 */
    .bopo .tone {
      position: absolute;
      right: -0.9em;
      top: 50%;
      font-family: "標楷體", "BiauKai", "DFKai-SB", serif;
      font-size: 1.07em;
      font-weight: bold;
      transform: translateY(-50%) scaleY(1.3);
      pointer-events: none;
    }

    /* 輕聲（˙）：固定於頂部正上方，防止黏住或飄開 */
    .bopo .tone.sp {
      position: absolute;
      left: 50%;
      right: auto;
      top: -0.55em; /* 穩定間距 */
      transform: translateX(-50%);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 1.6em; /* 適中大小，避免 em 暴衝 */
      line-height: 1;
      font-weight: 900;
      pointer-events: none;
    }

    /* 文字排列容器（讓 flex 文字自然換行與對齊） */
    .zh-text {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
    }
  `;
  document.head.appendChild(style);

  // 2. 轉換核心邏輯：將單一 <ruby> 標籤轉為客製化注音排版
  function convertRuby(rubyElement) {
    // 取得漢字
    const charText = Array.from(rubyElement.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('').trim();

    const rt = rubyElement.querySelector('rt');
    if (!rt) return;
    let bopoText = rt.textContent.trim();

    // 辨別聲調並徹底分離
    let tone = '';
    let bopoBase = bopoText;
    const normalTones = ['ˊ', 'ˇ', 'ˋ'];

    if (bopoText.includes('˙')) {
      tone = '˙';
      // 徹底清除文字內的所有輕聲符號，避免重複
      bopoBase = bopoText.replace(/˙/g, ''); 
    } else if (normalTones.includes(bopoText.slice(-1))) {
      tone = bopoText.slice(-1);
      bopoBase = bopoText.slice(0, -1);
    }

    // 建立 DOM 結構
    const charBlock = document.createElement('span');
    charBlock.className = 'char-block';

    const charSpan = document.createElement('span');
    charSpan.textContent = charText;
    charBlock.appendChild(charSpan);

    const bopoSpan = document.createElement('span');
    bopoSpan.className = 'bopo';
    bopoSpan.textContent = bopoBase;

    if (tone) {
      const toneSpan = document.createElement('span');
      toneSpan.className = tone === '˙' ? 'tone sp' : 'tone';
      toneSpan.textContent = tone;
      bopoSpan.appendChild(toneSpan);
    }

    charBlock.appendChild(bopoSpan);
    rubyElement.replaceWith(charBlock);
  }

  // 3. 掃描整個網頁並執行轉換
  function renderAll() {
    const rubies = document.querySelectorAll('ruby');
    rubies.forEach(convertRuby);
  }

  // 網頁載入完成自動執行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }

  // 對外公開 API，讓動態加入的文字也能隨時套用
  window.Bopomofo = {
    render: renderAll,
    convert: convertRuby
  };
})();