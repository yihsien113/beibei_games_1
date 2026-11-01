// RPG對話框模組
(function () {
  if (window.RPGDialog) return;

  let currentAudio = null; 
  let _isLocked = false; 

  // 1. 注入 CSS
  const style = document.createElement('style');
  style.id = 'rpg-dialog-style';
  style.textContent = `
    #rpg-dialog-box {
      position: fixed; bottom: 25px; left: 5%; width: 90%;
      border: 4px solid #fff; border-radius: 12px;
      background: linear-gradient(135deg, rgba(10,20,50,0.95), rgba(0,0,20,0.95));
      color: #fff; padding: 20px; z-index: 10001; box-shadow: 0 8px 20px rgba(0,0,0,0.8);
      display: none; touch-action: none; user-select: none; -webkit-user-select: none;
    }
    #rpg-dialog-text { font-size: 36px; line-height: 1.6; text-shadow: 0 2px 4px #000; text-align: center; }
    #rpg-dialog-hint { font-size: 20px; text-align: right; margin-top: 10px; color: #f1c40f; animation: rpg-blink 1.2s infinite; }
    @keyframes rpg-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  `;
  document.head.appendChild(style);

  // 2. 注入 HTML
  const dialogBox = document.createElement('div');
  dialogBox.id = 'rpg-dialog-box';
  dialogBox.innerHTML = `
    <div id="rpg-dialog-text" class="zh-text"></div>
    <div id="rpg-dialog-hint">▼ 點擊繼續</div>
  `;
  document.body.appendChild(dialogBox);

  // 3. API
  window.RPGDialog = {
    show: function (text, audioPath) {
      document.getElementById('rpg-dialog-text').innerHTML = text;
      document.getElementById('rpg-dialog-box').style.display = 'block';
      if (window.Bopomofo) window.Bopomofo.render();

      if (audioPath) {
        this.setHintVisible(false); 
        _isLocked = true; 
        
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        
        currentAudio = new Audio(audioPath);
        
        // 【新增防錯 1】：如果音檔找不到 (404)，立刻解鎖
        currentAudio.onerror = () => {
          console.warn("⚠️ 語音載入失敗，切換為純文字模式: " + audioPath);
          this.setHintVisible(true);
          _isLocked = false;
        };

        // 播放語音
        let playPromise = currentAudio.play();
        
        // 【新增防錯 2】：如果瀏覽器阻擋自動播放，立刻解鎖
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("⚠️ 語音播放失敗或被阻擋，切換為純文字模式: ", error);
            this.setHintVisible(true);
            _isLocked = false;
          });
        }
        
        // 正常播完解鎖
        currentAudio.onended = () => {
          this.setHintVisible(true);
          _isLocked = false; 
        };
        
      } else {
        this.setHintVisible(true);
        _isLocked = false; 
      }
    },
    
    hide: function () {
      document.getElementById('rpg-dialog-box').style.display = 'none';
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      _isLocked = false; 
    },
    
    setHintVisible: function (isVisible) {
      document.getElementById('rpg-dialog-hint').style.display = isVisible ? 'block' : 'none';
    },

    isLocked: function () {
      return _isLocked;
    },
    
    boxElement: dialogBox 
  };
})();