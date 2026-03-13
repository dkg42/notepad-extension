document.addEventListener('DOMContentLoaded', function() {
  const noteArea = document.getElementById('note-area');
  const saveButton = document.getElementById('save-button');

  // Load saved note
  chrome.storage.local.get('note', function(data) {
    if (data.note) {
      noteArea.value = data.note;
    }
  });

  // Save note
  saveButton.addEventListener('click', function() {
    const note = noteArea.value;
    chrome.storage.local.set({note: note}, function() {
      console.log('Note saved');
    });
  });
});
