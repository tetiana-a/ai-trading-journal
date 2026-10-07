(() => {
  'use strict';
  const lang = document.documentElement.lang;
  const files = {ru:'learning.html',uk:'learning-uk.html',en:'learning-en.html',cs:'learning-cs.html'};
  const selector = document.getElementById('learningLanguage');
  selector.value = lang;
  selector.addEventListener('change', () => {
    if (!files[selector.value]) return;
    try { localStorage.setItem('tk_lang',selector.value); } catch (_) {}
    window.location.assign(files[selector.value] + window.location.hash);
  });
  const theme = document.getElementById('themeTog');
  try { const saved=localStorage.getItem('tk_theme'); if (['light','dark'].includes(saved)) document.documentElement.dataset.theme=saved; } catch (_) {}
  theme.setAttribute('aria-label', {ru:'Переключить тему',uk:'Змінити тему',en:'Change theme',cs:'Změnit motiv'}[lang]);
  theme.addEventListener('click', () => {
    const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    try { localStorage.setItem('tk_theme',next); } catch (_) {}
  });
  const rows = [
    ['Audio Deck','Радио','Радіо','Rádio'],['AUDIO DECK','РАДИО','РАДІО','RÁDIO'],
    ['Close audio deck','Закрыть радио','Закрити радіо','Zavřít rádio'],['Now tuned to','Сейчас играет','Зараз грає','Právě naladěno'],
    ['Previous station','Предыдущая станция','Попередня станція','Předchozí stanice'],['Next station','Следующая станция','Наступна станція','Další stanice'],
    ['Play radio','Включить радио','Увімкнути радіо','Pustit rádio'],['Pause radio','Пауза','Пауза','Pozastavit rádio'],
    ['Cancel connection','Отменить подключение','Скасувати підключення','Zrušit připojení'],
    ['Station','Станция','Станція','Stanice'],['Radio volume','Громкость радио','Гучність радіо','Hlasitost rádia'],['VOL','ГРОМК.','ГУЧН.','HLAS.'],
    ['Visualizer on','Анимация включена','Анімацію ввімкнено','Animace zapnutá'],['Visualizer off','Анимация выключена','Анімацію вимкнено','Animace vypnutá'],
    ['Ready','Готово','Готово','Připraveno'],['Tuning…','Настройка…','Налаштування…','Ladění…'],
    ['Open Audio Deck','Открыть радио','Відкрити радіо','Otevřít rádio'],['Playing ','Играет ','Грає ','Hraje '],
    ['Reconnecting · ','Восстановление · ','Відновлення · ','Obnovování · '],['Connecting · ','Подключение · ','Підключення · ','Připojování · '],
    ['Station disconnected. Press Play to retry.','Связь потеряна. Нажмите ▶ для повтора.','Зв’язок втрачено. Натисніть ▶ ще раз.','Spojení přerušeno. Zkuste znovu ▶.'],
    ['Buffering…','Буферизация…','Буферизація…','Načítání…'],
    ['Press Play to allow audio.','Нажмите ▶ для воспроизведения.','Натисніть ▶ для відтворення.','Pro přehrávání stiskněte ▶.'],
    ['Stream unavailable. Try another station.','Поток недоступен. Выберите другую станцию.','Потік недоступний. Виберіть іншу станцію.','Stream není dostupný. Vyberte jinou stanici.'],
    ['Live · ','В эфире · ','В ефірі · ','Živě · '],[' · Ambient canvas',' · Фоновая анимация',' · Фонова анімація',' · Animace pozadí'],['Paused · ','Пауза · ','Пауза · ','Pozastaveno · ']
  ];
  rows.sort((a,b)=>b[0].length-a[0].length);
  const column={en:0,ru:1,uk:2,cs:3}[lang] ?? 0;
  window.localizeRadio = text => rows.reduce((value,row)=>value.includes(row[0])?value.replace(row[0],row[column]):value,text);
  window.localizeRadioControls = () => {
    for (const root of [document.getElementById('radioDock'),document.getElementById('radioBtn')]) {
      if (!root) continue;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); let node;
      while ((node=walker.nextNode())) {
        if (node.parentElement.closest('select,#radioStationName,#radioStationMeta,.radio-nav-label')) continue;
        const translated=window.localizeRadio(node.textContent);
        if (translated!==node.textContent) node.textContent=translated;
      }
      for (const el of [root,...root.querySelectorAll('[aria-label],[title]')]) for (const attr of ['aria-label','title']) {
        if(el.hasAttribute(attr)) el.setAttribute(attr,window.localizeRadio(el.getAttribute(attr)));
      }
    }
  };
})();
