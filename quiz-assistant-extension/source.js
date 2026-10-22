(async () => {
  try {
    const id = new URLSearchParams(location.search).get('id');
    const response = await fetch(chrome.runtime.getURL('knowledge-base.json'));
    if (!response.ok) throw Error('Không tải được kho nguồn.');
    const kb = await response.json(), page = kb.chunks.find(c => c.id === id);
    if (!page) throw Error('Không tìm thấy trang nguồn.');
    document.title = page.title;
    document.getElementById('title').textContent = page.title;
    document.getElementById('source').textContent = `${page.source}\n${page.path}`;
    document.getElementById('text').textContent = page.text;
  } catch (error) { document.getElementById('title').textContent = error.message; }
})();
