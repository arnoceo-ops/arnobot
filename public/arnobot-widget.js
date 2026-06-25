(function () {
  'use strict';

  var API_URL = 'https://www.arno.bot/api/chat';

  // Check bij laden of IP geblokkeerd is — zo ja, direct naar /lost
  fetch(API_URL, { method: 'GET' })
    .then(function (res) { return res.json(); })
    .then(function (data) { if (data.blocked) window.location.href = 'https://arno.blog/lost'; })
    .catch(function () {});

  var DEFAULT_OPENERS = [
    'Mijn salesteam haalt structureel de targets niet. Waar ligt dat aan?',
    'Wat onderscheidt een winnende salesorganisatie van een gemiddelde?',
    'Hoe bouw ik een commerciële strategie die de markt op z\'n kop zet?',
    'Mijn pipeline ziet er goed uit maar de conversie klopt niet. Oorzaken?',
    'Hoe haal en houd ik structureel topverkopers binnen?',
    'Ik heb superblije klanten, maar referrals? Ho maar. En nu?',
  ];

  var CSS = [
    '@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Open+Sans:wght@400;700&family=Playfair+Display:ital@0;1&display=swap");',
    '#arnobot-widget*{box-sizing:border-box;margin:0;padding:0}',
    '#arnobot-widget{',
    '  font-family:"Open Sans",sans-serif;',
    '  background:#fff;color:rgb(51,51,51);',
    '  max-width:100%;width:100%;',
    '  border:1px solid #e5e5e5;',
    '  display:flex;flex-direction:column;',
    '}',
    '#arnobot-header{',
    '  background:#fff;border-bottom:2px solid #EE7700;',
    '  padding:20px 28px;',
    '  display:flex;align-items:center;gap:16px;',
    '  flex-shrink:0;',
    '}',
    '#arnobot-avatar{',
    '  width:72px;height:72px;background:#EE7700;',
    '  display:flex;align-items:center;justify-content:center;',
    '  font-family:"Bebas Neue",sans-serif;font-size:48px;letter-spacing:1px;color:#fff;',
    '  flex-shrink:0;',
    '}',
    '#arnobot-header-text{}',
    '#arnobot-name{font-family:"Bebas Neue",sans-serif;font-size:28px;letter-spacing:3px;color:rgb(51,51,51);line-height:1;}',
    '#arnobot-status{font-size:10px;letter-spacing:2px;color:#EE7700;margin-top:2px;}',
    '#arnobot-messages{',
    '  flex:1;padding:0;',
    '  display:flex;flex-direction:column;',
    '}',
    '.ab-msg{padding:24px 28px;border-bottom:1px solid #f0f0f0;display:flex;gap:20px;align-items:flex-start;}',
    '.ab-msg-label{font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:2px;white-space:nowrap;padding-top:2px;min-width:64px;}',
    '.ab-msg-label.user{color:#bbb}',
    '.ab-msg-label.arno{color:#EE7700}',
    '.ab-msg-text.user{font-size:20px;line-height:1.4;color:rgb(51,51,51);font-family:"Bebas Neue",sans-serif;letter-spacing:0.5px;}',
    '.ab-msg-text.arno{font-size:15px;line-height:1.6;color:rgb(51,51,51);white-space:pre-wrap;max-width:560px;}',
    '.ab-loading{padding:24px 28px 24px 104px;display:flex;align-items:center;gap:12px;}',
    '.ab-dots{display:flex;gap:5px;}',
    '.ab-dot{width:7px;height:7px;background:#EE7700;border-radius:50%;animation:abpulse 1.2s ease-in-out infinite;}',
    '.ab-dot:nth-child(2){animation-delay:.2s}',
    '.ab-dot:nth-child(3){animation-delay:.4s}',
    '@keyframes abpulse{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}',
    '.ab-loading-text{font-size:12px;letter-spacing:2px;color:#bbb;text-transform:uppercase;}',
    '#arnobot-openers{padding:20px 28px 0;border-bottom:1px solid #f0f0f0;}',
    '.ab-openers-label{font-family:"Open Sans",sans-serif;font-size:17px;font-weight:700;letter-spacing:0;color:rgb(51,51,51);display:block;margin-bottom:6px;line-height:1.4;}',
    '.ab-openers-sub{font-family:"Open Sans",sans-serif;font-size:14px;font-weight:400;color:#888;display:block;margin-bottom:16px;line-height:1.5;}',
    '.ab-openers-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;margin-bottom:2px;}',
    '@media(max-width:480px){.ab-openers-grid{grid-template-columns:1fr}}',
    '.ab-opener{',
    '  background:#f7f7f7;border:none;border-left:3px solid transparent;color:rgb(51,51,51);',
    '  font-family:"Open Sans",sans-serif;font-size:15px;',
    '  padding:16px 18px;cursor:pointer;text-align:left;line-height:1.4;',
    '  transition:all .15s;',
    '}',
    '.ab-opener:hover{background:#EE7700;color:#fff;border-left-color:#cc6600;}',
    '#arnobot-input-area{',
    '  padding:16px 20px;background:#fff;border-top:1px solid #f0f0f0;',
    '  flex-shrink:0;',
    '  display:flex;flex-direction:column;align-items:center;',
    '}',
    '#arnobot-input-area>*{width:100%;max-width:600px;}',
    '#arnobot-input-row{',
    '  display:flex;gap:0;border:1.5px solid #ddd;transition:border-color .2s;',
    '}',
    '#arnobot-input-row.active{border-color:#EE7700;box-shadow:0 0 0 2px rgba(238,119,0,.1);}',
    '#arnobot-textarea{',
    '  flex:1;background:#fff;border:none;color:rgb(51,51,51);',
    '  font-family:"Open Sans",sans-serif;font-size:15px;',
    '  padding:12px 16px;outline:none;resize:none;',
    '  min-height:44px;max-height:44px;line-height:1.5;',
    '}',
    '#arnobot-textarea::placeholder{color:#bbb;font-size:13px;}',
    '#arnobot-textarea:focus{background:#fafafa;}',
    '#arnobot-send{',
    '  background:#EE7700;color:#fff;',
    '  font-family:"Bebas Neue",sans-serif;font-size:24px;letter-spacing:2px;',
    '  padding:0 24px;border:none;cursor:pointer;',
    '  transition:background .15s;white-space:nowrap;min-width:100px;',
    '}',
    '#arnobot-send:hover{background:#ff8800;}',
    '#arnobot-send:disabled{background:#f0f0f0;color:#ccc;cursor:not-allowed;}',
    '@media(max-width:700px){#arnobot-send{min-width:72px;padding:0 10px;font-size:18px;}}',
    '#arnobot-hint{font-size:9px;letter-spacing:2px;color:rgb(51,51,51);text-transform:uppercase;margin-top:6px;text-align:center;}',
    '#arnobot-actions{padding:16px 28px;display:flex;gap:10px;border-top:1px solid #f0f0f0;}',
    '.ab-action{',
    '  background:none;font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:2px;',
    '  padding:8px 16px;cursor:pointer;border:1px solid;transition:all .15s;',
    '}',
    '.ab-action.primary{color:#EE7700;border-color:#EE7700;}',
    '.ab-action.primary:hover{background:#EE7700;color:#fff;}',
    '.ab-action.secondary{color:#ccc;border-color:#e5e5e5;}',
    '.ab-action.secondary:hover{color:#999;border-color:#ccc;}',
    '.ab-hint{padding:12px 28px;font-size:15px;color:#EE7700;border-bottom:1px solid #f0f0f0;}',
    '.ab-cta{padding:20px 28px;border-bottom:1px solid #f0f0f0;}',
    '.ab-cta-heading{font-size:15px;font-weight:700;color:#555;margin:0 0 16px 0;}',
    '.ab-cta-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;}',
    '@media(max-width:520px){.ab-cta-cards{grid-template-columns:1fr}}',
    '.ab-cta-card{padding:20px;border:1px solid #e5e5e5;display:flex;flex-direction:column;gap:10px;}',
    '.ab-cta-card--primary{border-color:#EE7700;}',
    '.ab-cta-card-title{font-family:"Bebas Neue",sans-serif;font-size:20px;letter-spacing:2px;color:#555;}',
    '.ab-cta-card--primary .ab-cta-card-title{color:#EE7700;}',
    '.ab-cta-card-body{font-size:13px;color:#888;line-height:1.5;flex:1;}',
    '.ab-cta-btn--primary{display:block;background:#EE7700;color:#fff;font-family:"Bebas Neue",sans-serif;font-size:16px;letter-spacing:2px;padding:10px 16px;text-decoration:none;text-align:center;transition:background .15s;}',
    '.ab-cta-btn--primary:hover{background:#ff8800;}',
    '.ab-cta-btn--secondary{display:block;background:none;color:#EE7700;border:1.5px solid #EE7700;font-family:"Bebas Neue",sans-serif;font-size:16px;letter-spacing:2px;padding:10px 16px;text-decoration:none;text-align:center;transition:all .15s;}',
    '.ab-cta-btn--secondary:hover{background:#EE7700;color:#fff;}',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('arnobot-styles')) return;
    var el = document.createElement('style');
    el.id = 'arnobot-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderText(str) {
    return escapeHtml(str)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#EE7700;text-decoration:underline">$1</a>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function ArnoBot(container, opts) {
    opts = opts || {};
    this.container = container;
    this.history = [];
    this.loading = false;
    this.started = false;
    this.openers = opts.openers || DEFAULT_OPENERS;
    this._build();
  }

  ArnoBot.prototype._build = function () {
    var self = this;
    this.container.id = 'arnobot-widget';
    this.container.innerHTML = [
      '<div id="arnobot-header">',
      '  <div id="arnobot-avatar">AB</div>',
      '  <div id="arnobot-header-text">',
      '    <div id="arnobot-name">ARNOBOT</div>',
      '    <div id="arnobot-status">ONLINE &middot; DIRECTE ANTWOORDEN OP SALESVRAGEN</div>',
      '  </div>',
      '</div>',
      '<div id="arnobot-messages"></div>',
      '<div id="arnobot-openers">',
      '  <span class="ab-openers-label">Geen corporate vaagtaal. Gewoon Arno: direct en ongefilterd.</span>',
      '  <span class="ab-openers-sub">Kies een vraag hieronder — <span style="color:#EE7700">of stel je eigen vraag onderaan.</span></span>',
      '  <div class="ab-openers-grid">' + this.openers.map(function (q) {
        return '<button class="ab-opener">' + escapeHtml(q) + '</button>';
      }).join('') + '</div>',
      '</div>',
      '<div id="arnobot-input-area">',
      '  <div id="arnobot-input-row">',
      '    <textarea id="arnobot-textarea" rows="1" placeholder="Jouw eigen vraag aan Arno..."></textarea>',
      '    <button id="arnobot-send" disabled>VRAAG &rarr;</button>',
      '  </div>',
      '',
      '</div>',
    ].join('');

    this.$messages = this.container.querySelector('#arnobot-messages');
    this.$openers  = this.container.querySelector('#arnobot-openers');
    this.$inputRow = this.container.querySelector('#arnobot-input-row');
    this.$textarea = this.container.querySelector('#arnobot-textarea');
    this.$send     = this.container.querySelector('#arnobot-send');

    // Opener clicks
    var openerBtns = this.container.querySelectorAll('.ab-opener');
    for (var i = 0; i < openerBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.ask(btn.textContent);
        });
      })(openerBtns[i]);
    }

    // Textarea input
    this.$textarea.addEventListener('input', function () {
      self.$send.disabled = !self.$textarea.value.trim() || self.loading;
    });

    // Enter to send
    this.$textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!self.$send.disabled) self.ask(self.$textarea.value);
      }
    });

    // Send button
    this.$send.addEventListener('click', function () {
      self.ask(self.$textarea.value);
    });
  };

  ArnoBot.prototype.ask = function (question) {
    question = question.trim();
    if (!question || this.loading) return;

    if (!this.started) {
      this.started = true;
      this.$openers.style.display = 'none';
    }

    this._addUserMsg(question);
    this.$textarea.value = '';
    this.$send.disabled = true;
    this._setLoading(true);

    var self = this;
    var historySnapshot = this.history.slice();

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question, history: historySnapshot }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        self._setLoading(false);
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        if (data.blocked) {
          self._addCta('Je bent door je vragen heen. Wat nu?');
          self._setBlocked();
          return;
        }
        var answer = data.answer || 'Er ging iets mis. Probeer opnieuw.';
        self._addArnoMsg(answer);
        if (data.hint === 'last_chance') self._addHint('Je hebt nog één vraag over in deze sessie. Waar wil je op uitkomen?');
        if (data.hint === 'salescanvas') {
          self._addCta('Je bent door je vragen heen. Wat nu?');
          self._setBlocked();
        }
        self.history.push({ role: 'user', content: question });
        self.history.push({ role: 'assistant', content: answer });
        if (data.hint !== 'salescanvas') self._showActions();
      })
      .catch(function () {
        self._setLoading(false);
        self._addArnoMsg('Verbindingsfout. Probeer het opnieuw.');
      });
  };

  ArnoBot.prototype._addUserMsg = function (text) {
    var el = document.createElement('div');
    el.className = 'ab-msg';
    el.innerHTML = '<span class="ab-msg-label user">JIJ</span><span class="ab-msg-text user">' + escapeHtml(text) + '</span>';
    this.$messages.appendChild(el);
    this._scrollTo(el);
  };

  ArnoBot.prototype._addArnoMsg = function (text) {
    var el = document.createElement('div');
    el.className = 'ab-msg';
    el.innerHTML = '<span class="ab-msg-label arno">ARNO</span><span class="ab-msg-text arno">' + renderText(text) + '</span>';
    this.$messages.appendChild(el);
    this._scrollTo(el);
  };

  ArnoBot.prototype._setLoading = function (on) {
    this.loading = on;
    this.$send.disabled = on || !this.$textarea.value.trim();

    var existing = this.container.querySelector('.ab-loading');
    if (existing) existing.remove();

    if (on) {
      var el = document.createElement('div');
      el.className = 'ab-loading';
      el.innerHTML = '<div class="ab-dots"><div class="ab-dot"></div><div class="ab-dot"></div><div class="ab-dot"></div></div><span class="ab-loading-text">Arno denkt na</span>';
      this.$messages.appendChild(el);
      this._scrollTo(el);
    }
  };

  ArnoBot.prototype._addHint = function (text) {
    var el = document.createElement('div');
    el.className = 'ab-hint';
    el.textContent = text;
    this.$messages.appendChild(el);
  };

  ArnoBot.prototype._addCta = function (text) {
    var el = document.createElement('div');
    el.className = 'ab-cta';
    el.innerHTML = [
      '<p class="ab-cta-heading">' + text + '</p>',
      '<div class="ab-cta-cards">',
      '<div class="ab-cta-card ab-cta-card--primary">',
      '<div class="ab-cta-card-title">PRAAT MET ARNO</div>',
      '<div class="ab-cta-card-body">Niet de bot. Arno zelf. 30 minuten, gratis, geen verplichtingen.</div>',
      '<a href="https://arno.to/arnolive" target="_blank" rel="noopener noreferrer" class="ab-cta-btn--primary">PLAN EEN GRATIS GESPREK &rarr;</a>',
      '</div>',
      '<div class="ab-cta-card ab-cta-card--secondary">',
      '<div class="ab-cta-card-title">ARNOBOT UNLIMITED</div>',
      '<div class="ab-cta-card-body">Oneindig doorvragen. Tot je een ons weegt. Geen limiet, 24/7.</div>',
      '<a href="https://www.arno.bot/" target="_blank" class="ab-cta-btn--secondary">ABONNEER &rarr;</a>',
      '</div>',
      '</div>',
    ].join('');
    this.$messages.appendChild(el);
    this._scrollTo(el);
  };

  ArnoBot.prototype._setBlocked = function () {
    this.loading = false;
    this.$textarea.disabled = true;
    this.$send.disabled = true;
    this.$textarea.placeholder = '';
    var actions = this.container.querySelector('#arnobot-actions');
    if (actions) actions.style.display = 'none';
    var inputArea = this.container.querySelector('#arnobot-input-area');
    if (inputArea) inputArea.style.display = 'none';
  };

  ArnoBot.prototype._showActions = function () {
    var self = this;
    var existing = this.container.querySelector('#arnobot-actions');
    if (existing) existing.remove();

    var el = document.createElement('div');
    el.id = 'arnobot-actions';
    el.innerHTML = '<button class="ab-action primary">&#8593; Vervolgvraag stellen</button><button class="ab-action secondary">&#8592; Nieuwe sessie</button>';

    el.querySelector('.ab-action.primary').addEventListener('click', function () {
      self.$textarea.focus();
    });
    el.querySelector('.ab-action.secondary').addEventListener('click', function () {
      self._reset();
    });

    self.$textarea.placeholder = 'Stel een vervolgvraag...';

    this.container.insertBefore(el, this.container.querySelector('#arnobot-input-area'));
  };

  ArnoBot.prototype._reset = function () {
    this.history = [];
    this.started = false;
    this.loading = false;
    this.$messages.innerHTML = '';
    this.$textarea.value = '';
    this.$send.disabled = true;
    this.$openers.style.display = '';
    this.$textarea.placeholder = 'Jouw eigen vraag aan Arno...';
    var existing = this.container.querySelector('#arnobot-actions');
    if (existing) existing.remove();
  };

  ArnoBot.prototype._scrollTo = function (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();

    // Zoek bestaand target element of maak er een aan
    var target = document.getElementById('arnobot') || document.getElementById('arnobot-widget');
    if (!target) {
      target = document.createElement('div');
      // Voeg toe na het script-tag zelf
      var scripts = document.querySelectorAll('script[src*="arnobot-widget"]');
      var lastScript = scripts[scripts.length - 1];
      if (lastScript && lastScript.parentNode) {
        lastScript.parentNode.insertBefore(target, lastScript.nextSibling);
      } else {
        document.body.appendChild(target);
      }
    }

    new ArnoBot(target);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
