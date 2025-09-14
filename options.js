document.addEventListener('DOMContentLoaded', () => {
  const sitesInput = document.getElementById('sites');
  const difficultySelect = document.getElementById('difficulty');
  const redirectUrlInput = document.getElementById('redirectUrl');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Set defaults immediately
  sitesInput.value = '';
  difficultySelect.value = 'easy';
  redirectUrlInput.value = 'https://www.upwork.com';

  chrome.storage.sync.get(['blockedSites', 'difficulty', 'redirectUrl'], (data) => {
    sitesInput.value = (data.blockedSites || []).join('\n');
    difficultySelect.value = data.difficulty || 'easy';
    redirectUrlInput.value = data.redirectUrl || 'https://www.upwork.com';
  });

  saveButton.addEventListener('click', () => {
    const sites = sitesInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const difficulty = difficultySelect.value;
    const redirectUrl = redirectUrlInput.value.trim() || 'https://www.upwork.com';
    chrome.storage.sync.set({ blockedSites: sites, difficulty, redirectUrl }, () => {
      statusDiv.textContent = 'Settings saved! Reload extension to apply site changes.';
      setTimeout(() => statusDiv.textContent = '', 3000);
    });
  });
});