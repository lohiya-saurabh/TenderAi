(async () => {
  try {
    const res = await fetch('http://localhost:5173/src/index.css');
    console.log('STATUS:', res.status);
    const text = await res.text();
    const match = text.match(/const error = (\{.*?\});/s);
    if (match) {
      console.log('PARSED ERROR:', JSON.parse(match[1]).message);
      console.log('FRAME:', JSON.parse(match[1]).frame);
    } else {
      console.log('BODY:', text.slice(0, 500));
    }
  } catch (err) {
    console.error('FETCH ERROR:', err);
  }
})();
