/* The offline page's Try Again: asks for the page again; offline.html shows once more if the server is still out of reach. */
document.getElementById('retry').addEventListener('click', () => {
  window.location.reload();
});
