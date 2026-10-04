// FORMAT brand motion. Tiny, no dependencies. Styles live in fx.css.
(function(){
  var d=document,h=d.documentElement;
  var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduced)return;

  // [ ] loader: shown once per browser session, held for ~1s so the draw-on finishes.
  // Add ?loader to any page URL to preview it.
  var seen;try{seen=sessionStorage.getItem('fxSeen')}catch(e){}
  try{sessionStorage.setItem('fxSeen','1')}catch(e){}
  if(/[?&]loader\b/.test(location.search)||!seen){
    var t0=Date.now(),MIN=1000,done=false;
    h.classList.add('fx-wait');
    var el=d.createElement('div');
    el.className='fx-load';el.setAttribute('aria-hidden','true');
    el.innerHTML='<svg viewBox="0 0 120 60"><path class="b l" d="M24 6H10v48h14"/><path class="b r" d="M96 6h14v48H96"/><line class="ln" x1="60" y1="14" x2="60" y2="46"/></svg><span class="w">Format</span>';
    h.appendChild(el);
    var out=function(){
      if(done)return;done=true;
      el.classList.add('out');
      setTimeout(function(){h.classList.remove('fx-wait')},260);
      setTimeout(function(){el.remove()},900);
    };
    var go=function(){setTimeout(out,Math.max(0,MIN-(Date.now()-t0)))};
    if(d.readyState==='complete')go();else window.addEventListener('load',go);
    setTimeout(out,4500);
    el.addEventListener('click',out);
  }

  // viewfinder cursor over linked photos, mouse devices only
  if(!(window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches))return;
  d.addEventListener('DOMContentLoaded',function(){
    var c=d.createElement('div');
    c.className='fx-cur';c.setAttribute('aria-hidden','true');
    c.innerHTML='<div class="bx"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="t">View</span></div>';
    d.body.appendChild(c);
    h.classList.add('fx-cur-on');
    var x=0,y=0,cx=0,cy=0,run=false;
    function tick(){
      cx+=(x-cx)*.22;cy+=(y-cy)*.22;
      c.style.transform='translate('+cx.toFixed(1)+'px,'+cy.toFixed(1)+'px)';
      if(c.classList.contains('on')||Math.abs(x-cx)+Math.abs(y-cy)>.5)requestAnimationFrame(tick);else run=false;
    }
    function over(e){
      var p=e.target.closest&&e.target.closest('.ph');
      var on=!!(p&&p.closest('a'));
      if(on&&!c.classList.contains('on')){cx=x;cy=y}
      c.classList.toggle('on',on);
      if(on&&!run){run=true;requestAnimationFrame(tick)}
    }
    d.addEventListener('mousemove',function(e){x=e.clientX;y=e.clientY;over(e)},{passive:true});
    d.addEventListener('mouseleave',function(){c.classList.remove('on')});
  });
})();
