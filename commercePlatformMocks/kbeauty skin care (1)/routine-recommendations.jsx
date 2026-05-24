// Right-side drawer that shows recommended changes against the user's
// current routine, slot-by-slot. User can Buy / Dismiss per item, or
// Buy All as a bundle. When applied, parent updates the routine.

function ProductMini({ product, currentSwap }) {
  if (!product) {
    return (
      <div className="side now">
        <div className="thumb"><div className="ph-bottle" style={{ background: 'var(--cream)' }}>·</div></div>
        <div className="meta">
          <div className="label">Not in routine</div>
          <div className="nm muted" style={{ fontWeight: 400 }}>No product</div>
        </div>
      </div>
    );
  }
  const code = window.__currency || 'USD';
  return (
    <div className={'side' + (currentSwap ? ' now' : '')}>
      <div className="thumb"><div className="ph-bottle" style={{ background: product.color }}>{product.brand[0]}</div></div>
      <div className="meta">
        <div className="label">{currentSwap ? 'Currently' : 'Recommended'}</div>
        <div className="nm"><span className="brand">{product.brand}</span> · {product.name}</div>
        {product.price && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Price product={product}/>
            {product.prevPrice && product.prevPrice > product.price && <span className="sale-pill">Sale</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function DiffRow({ rec, applied, dismissed, onBuy, onDismiss }) {
  const cur = rec.currentId ? PRODUCTS[rec.currentId] : null;
  const next = PRODUCTS[rec.recId];
  const cat = CAT[(next || cur).cat];
  const badgeMap = { keep: 'badge-keep', swap: 'badge-swap', new: 'badge-new' };
  const labelMap = { keep: 'Keep', swap: 'Swap', new: 'Add new' };
  return (
    <div className="diff">
      <div className="diff-head">
        {React.createElement(RIcon[cat.icon], { style: { width: 16, height: 16, color: 'var(--ink-2)' } })}
        <span className="cat">{cat.label}</span>
        <span className={'badge ' + badgeMap[rec.type]}>{labelMap[rec.type]}</span>
        {rec.type !== 'keep' && next?.price && (
          <span style={{ marginLeft: 'auto' }}><Price product={next}/></span>
        )}
      </div>

      {rec.type === 'keep' ? (
        <ProductMini product={next} currentSwap/>
      ) : rec.type === 'new' ? (
        <ProductMini product={next}/>
      ) : (
        <div className="pair">
          <ProductMini product={cur} currentSwap/>
          <div className="arrow"><RIcon.ArrowRight style={{ width: 18, height: 18 }}/></div>
          <ProductMini product={next}/>
        </div>
      )}

      {(rec.reason || rec.type !== 'keep') && (
        <div className="diff-foot">
          <div className="reason">{rec.reason || 'You\'re already using a great option here — no change needed.'}</div>
          {rec.type === 'keep' ? null : applied ? (
            <span className="applied"><RIcon.Check style={{ width: 14, height: 14 }}/> Added to routine</span>
          ) : dismissed ? (
            <span className="muted" style={{ fontSize: 12.5 }}>Dismissed</span>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={onDismiss}>Dismiss</button>
              <button className="btn btn-dark btn-sm" onClick={onBuy}>
                <RIcon.Bag style={{ width: 14, height: 14 }}/> Buy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationsDrawer({ recs, slot, onSlotChange, onClose, applied, tweaks, onApply, onApplyAll, onDismiss }) {
  const items = recs[slot];
  const code = window.__currency || 'USD';
  const changes = items.filter(r => r.type !== 'keep' && !applied[r.recId]);
  const unappliedItems = items.filter(r => r.type !== 'keep' && applied[r.recId] !== true && applied[r.recId] !== 'dismissed');
  const totalChanges = items.filter(r => r.type !== 'keep').length;
  const appliedCount = items.filter(r => r.type !== 'keep' && applied[r.recId] === true).length;

  // Bundle math
  const bundleSubtotal = unappliedItems.reduce((s, r) => s + (PRODUCTS[r.recId]?.price || 0), 0);
  const disc = (tweaks?.bundleDiscount || 0) / 100;
  const bundleTotal = bundleSubtotal * (1 - disc);
  const bundleSavings = bundleSubtotal * disc;
  const shipThreshold = tweaks?.shipThreshold || 0;
  const freeShip = bundleTotal >= shipThreshold;

  return (
    <React.Fragment>
      <div className="drawer-scrim" onClick={onClose}/>
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <h3>Your custom routine</h3>
            <div className="sub">From your skin quiz · {totalChanges} suggested changes</div>
          </div>
          <button className="iconbtn-close" onClick={onClose} aria-label="Close"><RIcon.Close/></button>
        </div>

        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div className="seg">
            <button className={slot === 'morning' ? 'on' : ''} onClick={() => onSlotChange('morning')}><RIcon.Sun/>Morning</button>
            <button className={slot === 'evening' ? 'on' : ''} onClick={() => onSlotChange('evening')}><RIcon.Moon/>Evening</button>
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {appliedCount} of {totalChanges} added
          </div>
        </div>

        <div className="drawer-body">
          {items.map((r, i) => (
            <DiffRow key={i} rec={r}
              applied={applied[r.recId] === true}
              dismissed={applied[r.recId] === 'dismissed'}
              onBuy={() => onApply(slot, r)}
              onDismiss={() => onDismiss(slot, r)}/>
          ))}
        </div>

        <div className="drawer-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
          {/* Bundle summary */}
          {unappliedItems.length > 0 ? (
            <React.Fragment>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                    Buy {unappliedItems.length} item{unappliedItems.length === 1 ? '' : 's'} as a bundle
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {tweaks?.bundleDiscount > 0 && (
                      <span>Save {tweaks.bundleDiscount}% — {fmtPrice(bundleSavings, code)} off · </span>
                    )}
                    {freeShip ? (
                      <span style={{ color: 'var(--green)' }}>Free shipping included</span>
                    ) : (
                      <span>{fmtPrice(shipThreshold - bundleTotal, code)} from free shipping</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Price product={{ price: bundleTotal, prevPrice: tweaks?.bundleDiscount > 0 ? bundleSubtotal : undefined }} size="xl"/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Maybe later</button>
                <button className="btn btn-primary" onClick={() => onApplyAll(slot)}
                  style={{ flex: 2 }}>
                  <RIcon.Bag style={{ width: 16, height: 16 }}/>
                  Buy bundle · {fmtPrice(bundleTotal, code)}
                </button>
              </div>
            </React.Fragment>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { RecommendationsDrawer });
