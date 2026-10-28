import './AssetStatusSummary.css'

type Props = { assets: readonly { status: string }[]; loading: boolean; failed: boolean }

export function AssetStatusSummary({ assets, loading, failed }: Props) {
  if (loading || failed) return <section className="asset-summary" aria-label="장비 상태별 수량">
    <h2>장비 현황</h2><p role="status">{loading ? '장비 현황을 불러오는 중입니다.' : '장비 현황 확인 불가'}</p>
  </section>
  const counts = { available: 0, loaned: 0, repair: 0, archived: 0, other: 0 }
  for (const asset of assets) {
    switch (asset.status) {
      case 'available': counts.available++; break
      case 'loaned': counts.loaned++; break
      case 'repair': counts.repair++; break
      case 'archived': counts.archived++; break
      default: counts.other++
    }
  }
  return <section className="asset-summary" aria-label="장비 상태별 수량">
    <h2>장비 현황</h2><p>전체 장비 기준</p>
    <dl>{[['전체', assets.length], ['대여 가능', counts.available], ['대여 중', counts.loaned], ['수리 중', counts.repair]].map(([label, count]) =>
      <div key={label}><dt>{label}</dt><dd>{count}대</dd></div>)}</dl>
    {counts.archived || counts.other ? <p>{[counts.archived ? `보관 ${counts.archived}대` : '', counts.other ? `기타 ${counts.other}대` : ''].filter(Boolean).join(' · ')}</p> : null}
  </section>
}
