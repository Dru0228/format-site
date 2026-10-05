// FORMAT brand motion. Tiny, no dependencies. Styles live in fx.css.
(function(){
  var d=document,h=d.documentElement;
  var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduced)return;

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
