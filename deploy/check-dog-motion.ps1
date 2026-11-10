param([string]$BaseUrl = 'http://127.0.0.1:8765')
$ErrorActionPreference = 'Stop'
$sessionName = 'eco-dog-regression'
$browserStarted = $false
try {
    foreach ($width in @(390, 1440)) {
        agent-browser --session $sessionName open "$BaseUrl/sorting.html#quiz"
        $browserStarted = $true
        agent-browser --session $sessionName set viewport $width 1000
        foreach ($mood in @('idle-a', 'happy', 'sad', 'cheer')) {
            agent-browser --session $sessionName reload
            agent-browser --session $sessionName scrollintoview '#quiz .quiz-layout'
            $probe = @'
(async () => {
  const wanted = '__MOOD__';
  const fig = document.getElementById('dogFigure');
  if (wanted === 'cheer') {
    for (let i = 0; i < QUESTIONS.length; i++) {
      document.querySelectorAll('.quiz-option')[QUESTIONS[i].right].click();
      document.getElementById('quizNext').click();
    }
  } else if (wanted !== 'idle-a') {
    const correct = QUESTIONS[0].right;
    document.querySelectorAll('.quiz-option')[wanted === 'happy' ? correct : (correct + 1) % 3].click();
  }
  const video = fig.querySelector('video');
  const deadline = performance.now() + 15000;
  while (!video || !video.currentSrc.endsWith('/' + wanted + '.mp4') || video.readyState < 2 || video.paused || fig.classList.contains('is-still')) {
    if (performance.now() > deadline) throw new Error('Dog video did not start: ' + wanted + ' ' + JSON.stringify({video:!!video,src:video&&video.currentSrc,paused:video&&video.paused,classes:fig.className,top:fig.getBoundingClientRect().top}));
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await new Promise(resolve => setTimeout(resolve, 1500));
  let mutations = 0, frames = 0, done = false;
  const positions = [];
  const observer = new MutationObserver(records => { mutations += records.length; });
  observer.observe(fig, {attributes:true, attributeFilter:['class']});
  function frame() { if (done) return; frames++; video.requestVideoFrameCallback(frame); }
  video.requestVideoFrameCallback(frame);
  const timer = setInterval(() => { const r = fig.getBoundingClientRect(); positions.push([r.x, r.y]); }, 40);
  await new Promise(resolve => setTimeout(resolve, 800));
  done = true;
  clearInterval(timer);
  observer.disconnect();
  const range = index => Math.max(...positions.map(p => p[index])) - Math.min(...positions.map(p => p[index]));
  return {mood:wanted, frames, classMutations:mutations, containerTweens:gsap.getTweensOf(fig).length, deltaX:range(0), deltaY:range(1)};
})()
'@
            $probe = $probe.Replace('__MOOD__', $mood)
            $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($probe))
            $raw = agent-browser --session $sessionName eval -b $encoded
            if ($LASTEXITCODE -ne 0) { throw "Browser probe failed: $width / $mood" }
            $stats = ($raw -join "`n") | ConvertFrom-Json
            if ($stats.frames -lt 3 -or $stats.classMutations -ne 0 -or $stats.containerTweens -ne 0 -or $stats.deltaX -gt 0.1 -or $stats.deltaY -gt 0.1) {
                throw "Dog motion regression at width $width : $($stats | ConvertTo-Json -Compress)"
            }
            Write-Output "$width px: $($stats | ConvertTo-Json -Compress)"
        }
        agent-browser --session $sessionName close
        $browserStarted = $false
    }
    Write-Output 'PASS: 8 dog-motion scenarios; video moves, container stays stable.'
} finally {
    if ($browserStarted) { agent-browser --session $sessionName close }
}
