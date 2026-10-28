import './AssetFilters.css'

// category: null이면 전체, ''이면 미분류
export type AssetFilterValue = { category: string | null; status: string }
type FilterableAsset = { category: string; status: string }

export const noFilter: AssetFilterValue = { category: null, status: '' }
const statusOptions = [['available', '대여 가능'], ['repair', '수리 중'], ['loaned', '대여 중'], ['archived', '보관됨']]

function categoryOptions(assets: FilterableAsset[]) {
  const namedCategories = [...new Set(assets.map(asset => asset.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
  return assets.some(asset => !asset.category.trim()) ? [...namedCategories, ''] : namedCategories
}

// 수정·등록으로 선택한 분류가 목록에서 사라지면 화면 표시와 같게 '전체 분류'로 본다
function activeCategory(assets: FilterableAsset[], category: string | null) {
  return category !== null && categoryOptions(assets).includes(category) ? category : null
}

export function filterAssets<T extends FilterableAsset>(assets: T[], filter: AssetFilterValue) {
  const category = activeCategory(assets, filter.category)
  return assets.filter(asset => (category === null || asset.category.trim() === category) && (!filter.status || asset.status === filter.status))
}

export function AssetFilters({ assets, value, onChange }: { assets: FilterableAsset[]; value: AssetFilterValue; onChange: (value: AssetFilterValue) => void }) {
  const category = activeCategory(assets, value.category)
  return <div className="asset-filters">
    <label htmlFor="asset-category-filter" className="sr-only">분류 필터</label>
    {/* 선택값은 'c:' 접두어로 구분해 '전체'와 '미분류', 실제 분류 이름이 겹치지 않게 한다 */}
    <select id="asset-category-filter" value={category === null ? '' : `c:${category}`} onChange={event => onChange({ ...value, category: event.target.value ? event.target.value.slice(2) : null })}>
      <option value="">전체 분류</option>
      {categoryOptions(assets).map(option => <option key={option} value={`c:${option}`}>{option || '미분류'}</option>)}
    </select>
    <label htmlFor="asset-status-filter" className="sr-only">상태 필터</label>
    <select id="asset-status-filter" value={value.status} onChange={event => onChange({ ...value, status: event.target.value })}>
      <option value="">전체 상태</option>
      {statusOptions.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
    </select>
  </div>
}
