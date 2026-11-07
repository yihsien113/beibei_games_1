// player.js
// 統一管理所有角色的基本屬性與攻擊特效
const PLAYER_CHARACTERS = {
  'han1': {
    name: '揮劍女孩', prefix: 'han1', size: 160, hitboxOffsetX: 100, hitboxOffsetY: 0, hitboxRadius: 40,
    drawEffect: (ctx, p, startX, startY, targetX, targetY) => {
      ctx.save(); 
      ctx.strokeStyle = `rgba(135, 206, 235, ${1 - p})`; 
      ctx.shadowColor = '#00bfff'; 
      ctx.shadowBlur = 15; 
      ctx.lineWidth = 12 * (1 - p);
      ctx.beginPath(); 
      
      if (targetX < startX) {
        ctx.arc(targetX, targetY, 30 + p * 40, Math.PI / 2, Math.PI * 1.5);
      } else {
        ctx.arc(targetX, targetY, 30 + p * 40, -Math.PI / 2, Math.PI / 2); 
      }
      
      ctx.stroke(); 
      ctx.restore();
    }
  },
  'han2': {
    name: '弓箭公主', prefix: 'han2', size: 170, hitboxOffsetX: 130, hitboxOffsetY: 0, hitboxRadius: 50,
    drawEffect: (ctx, p, startX, startY, targetX, targetY) => {
      ctx.save(); ctx.strokeStyle = `rgba(255, 105, 180, ${1 - p})`; ctx.shadowColor = '#ff1493'; ctx.shadowBlur = 20; ctx.lineWidth = 8 * (1 - p);
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(targetX, targetY); ctx.stroke();
      ctx.font = `${30 + p * 30}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 1 - p; ctx.fillText('💖', targetX, targetY - p * 20); ctx.restore();
    }
  },
  'han3': {
    name: '魔法仙子', prefix: 'han3', size: 160, hitboxOffsetX: 110, hitboxOffsetY: 0, hitboxRadius: 65,
    drawEffect: (ctx, p, startX, startY, targetX, targetY) => {
      ctx.save(); 
      
      if (p < 0.65) {
        const dropProgress = p / 0.65;
        const dropY = targetY - 260 * (1 - dropProgress); 
        
        ctx.translate(targetX, dropY); 
        ctx.rotate(dropProgress * Math.PI * 2); 
        
        ctx.shadowColor = '#FFE066'; 
        ctx.shadowBlur = 25; 
        ctx.globalAlpha = Math.min(1, dropProgress * 3); 
        ctx.font = '110px sans-serif'; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle'; 
        ctx.fillText('🌙', 0, 0);
      } else {
        const burstP = (p - 0.65) / 0.35;
        ctx.translate(targetX, targetY);
        
        ctx.strokeStyle = `rgba(255, 223, 70, ${1 - burstP})`;
        ctx.lineWidth = 8 * (1 - burstP);
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, burstP * 90, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 10;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI * 2) / 8 + burstP * 1.5;
          const dist = burstP * 110;
          ctx.globalAlpha = 1 - burstP;
          ctx.font = `${36 * (1 - burstP * 0.4)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✨', Math.cos(angle) * dist, Math.sin(angle) * dist);
        }
      }
      
      ctx.restore();
    }
  },
  'han4': {
    name: '漩渦公主', prefix: 'han4', size: 165, hitboxOffsetX: 120, hitboxOffsetY: 0, hitboxRadius: 55,
    drawEffect: (ctx, p, startX, startY, targetX, targetY) => {
      ctx.save(); 
      ctx.translate(targetX, targetY);

      ctx.rotate(-p * Math.PI * 8);
      ctx.lineWidth = 6 * (1 - p);
      for (let r = 25; r <= 95; r += 22) {
        ctx.strokeStyle = `rgba(186, 104, 200, ${1 - p})`;
        ctx.shadowColor = '#e1bee7';
        ctx.shadowBlur = 12 * (1 - p);
        ctx.beginPath();
        ctx.arc(0, 0, r * (1 - p * 0.4), 0, Math.PI * 1.4);
        ctx.stroke();
      }

      const items = ['🧦', '🧱', '🧸', '✨', '💨'];
      items.forEach((item, idx) => {
        const angle = (idx * Math.PI * 2) / items.length + p * Math.PI * 4;
        const dist = (1 - p) * 115;
        const itemScale = Math.max(0.2, 1 - p * 0.8);
        ctx.save();
        ctx.font = `${26 * itemScale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.max(0, 1 - p * 0.5);
        ctx.fillText(item, Math.cos(angle) * dist, Math.sin(angle) * dist);
        ctx.restore();
      });

      if (p > 0.65) {
        const popP = (p - 0.65) / 0.35;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.max(0, 1 - popP);

        const cloudScale = 40 + popP * 30;
        ctx.font = `${cloudScale}px sans-serif`;
        ctx.fillText('💨', 0, 0);

        const starCount = 5;
        const starDist = popP * 60;
        ctx.font = `${22 * (1 - popP * 0.3)}px sans-serif`;
        for (let i = 0; i < starCount; i++) {
          const a = (i * Math.PI * 2) / starCount + popP * 2;
          ctx.fillText('✨', Math.cos(a) * starDist, Math.sin(a) * starDist);
        }
      }

      ctx.restore(); 
    }
  },
  'han5': {
    name: '愛心公主', prefix: 'han5', size: 165, hitboxOffsetX: 120, hitboxOffsetY: 0, hitboxRadius: 55,
    drawEffect: (ctx, p, startX, startY, targetX, targetY) => {
      ctx.save();
      
      const currentX = startX + (targetX - startX) * p;
      const currentY = startY + (targetY - startY) * p;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currentX, currentY);
      ctx.strokeStyle = `rgba(255, 182, 193, ${0.4 * (1 - p)})`;
      ctx.lineWidth = 3; 
      ctx.stroke();

      ctx.translate(currentX, currentY);
      
      let heartScale = 1;
      if (p < 0.2) heartScale = p / 0.2; 
      else if (p > 0.8) heartScale = 1 - (p - 0.8); 
      
      ctx.rotate(Math.sin(p * Math.PI * 2) * 0.05); 
      ctx.scale(heartScale, heartScale);

      ctx.font = '65px sans-serif'; 
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'transparent'; 
      ctx.shadowBlur = 0;
      
      ctx.globalAlpha = p > 0.85 ? 1 - ((p - 0.85) / 0.15) : 1;
      ctx.fillText('💖', 0, 0);
      ctx.restore();

      if (p > 0.8) {
        ctx.save();
        const burstP = (p - 0.8) / 0.2; 
        ctx.translate(targetX, targetY);
        ctx.globalAlpha = 1 - burstP;

        ctx.beginPath();
        ctx.arc(0, 0, burstP * 65, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 20, 147, ${1 - burstP})`;
        ctx.lineWidth = 5 * (1 - burstP);
        ctx.stroke();

        ctx.restore();
      }
    }
  },
  'chih1': {
    name: '揮劍里長', prefix: 'chih1', size: 160, hitboxOffsetX: 100, hitboxOffsetY: 0, hitboxRadius: 40,
    drawEffect: (ctx, p, startX, startY, targetX, targetY) => {
      ctx.save(); 
      ctx.strokeStyle = `rgba(135, 206, 235, ${1 - p})`; 
      ctx.shadowColor = '#00bfff'; 
      ctx.shadowBlur = 15; 
      ctx.lineWidth = 12 * (1 - p);
      ctx.beginPath(); 
      
      if (targetX < startX) {
        ctx.arc(targetX, targetY, 30 + p * 40, Math.PI / 2, Math.PI * 1.5);
      } else {
        ctx.arc(targetX, targetY, 30 + p * 40, -Math.PI / 2, Math.PI / 2); 
      }
      
      ctx.stroke(); 
      ctx.restore();
    }
  },
  'chih2': {
    name: '飛車男孩', prefix: 'chih2', size: 160, hitboxOffsetX: 100, hitboxOffsetY: 0, hitboxRadius: 40,
    drawEffect: (ctx, p, startX, startY, targetX, targetY) => {
      ctx.save();
      
      // 判斷攻擊方向：targetX 大於 startX 代表向右邊攻擊
      const isFacingRight = targetX > startX;

      // 直線衝刺軌跡
      const currentX = startX + (targetX - startX) * p;
      const currentY = startY + (targetY - startY) * p;

      // 1. 召喚放大效果
      let scale = p < 0.15 ? p / 0.15 : 1;
      
      // 2. 畫出後方速度線
      if (p > 0.15 && p < 0.9) {
        ctx.save();
        ctx.strokeStyle = `rgba(200, 200, 200, ${1 - p})`;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        // 根據方向決定速度線要在車子的左邊還是右邊
        const offset = isFacingRight ? -80 : 80; 
        
        ctx.moveTo(currentX + offset, currentY - 20);
        ctx.lineTo(currentX + offset * 1.5, currentY - 20);
        ctx.moveTo(currentX + offset * 0.8, currentY + 25);
        ctx.lineTo(currentX + offset * 1.8, currentY + 25);
        
        ctx.stroke();
        ctx.restore();
      }

      // 3. 繪製汽車本體
      ctx.translate(currentX, currentY);
      
      // 【關鍵修正】預設車頭向左，如果向右攻擊，則把 X 軸縮放設為負數(-scale)來達成水平翻轉
      ctx.scale(isFacingRight ? -scale : scale, scale);

      ctx.font = '110px sans-serif'; 
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚗', 0, 0); 
      
      ctx.restore();

      // 4. 擊中目標的爆炸與撞擊特效
      if (p > 0.8) {
        ctx.save();
        const burstP = (p - 0.8) / 0.2; 
        ctx.translate(targetX, targetY);
        ctx.globalAlpha = 1 - burstP; 
        
        // 爆炸符號
        ctx.font = `${80 + burstP * 50}px sans-serif`; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥', 0, 0);
        
        // 【關鍵修正】煙霧 💨 預設也是向左，向右攻擊時同樣水平翻轉，確保風切方向一致
        ctx.scale(isFacingRight ? -1 : 1, 1);
        
        ctx.font = `${40 + burstP * 30}px sans-serif`; 
        ctx.fillText('💨', 40, 30);
        ctx.fillText('💨', -30, -20);
        ctx.restore();
      }
    }
  },
};