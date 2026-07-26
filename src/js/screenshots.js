/**
 * screenshots.js — Screenshot upload, paste, drag & drop, and preview management.
 */

const ssDropzone  = document.getElementById('ssDropzone');
const ssFile      = document.getElementById('ssFile');
const ssPreviews  = document.getElementById('ssPreviews');

ssDropzone.addEventListener('click', () => ssFile.click());
ssFile.addEventListener('change', (e) => handleFiles(e.target.files));

ssDropzone.addEventListener('dragover', (e) => { e.preventDefault(); ssDropzone.classList.add('dragover'); });
ssDropzone.addEventListener('dragleave', () => ssDropzone.classList.remove('dragover'));
ssDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  ssDropzone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

document.addEventListener('paste', (e) => {
  // Only accept paste when focus is inside the add-section or on body
  if (!document.getElementById('add').contains(document.activeElement) && document.activeElement.tagName !== 'BODY') return;
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      handleFiles([items[i].getAsFile()]);
    }
  }
});

/**
 * Process file inputs — read, resize, and store as data URLs.
 * @param {FileList|File[]} files
 */
function handleFiles(files) {
  if (!files || !files.length) return;
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 800px wide to save localStorage space
        const canvas = document.createElement('canvas');
        const maxW = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * (maxW / w); w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        currentScreenshots.push(dataUrl);
        renderFormScreenshots();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Render thumbnail previews in the form with delete buttons. */
function renderFormScreenshots() {
  ssPreviews.innerHTML = '';
  currentScreenshots.forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'ss-thumb';
    div.innerHTML = `<img src="${src}"><button class="ss-del" data-i="${i}">✕</button>`;
    ssPreviews.appendChild(div);
  });
  ssPreviews.querySelectorAll('.ss-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentScreenshots.splice(btn.dataset.i, 1);
      renderFormScreenshots();
    });
  });
}
