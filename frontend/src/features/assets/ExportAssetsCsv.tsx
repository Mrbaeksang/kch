import './ExportAssetsCsv.css'

type ExportableAsset = { assetNumber: string; name: string; model: string; category: string; location: string; status: string }

const columns: { label: string; value: (asset: ExportableAsset, statusLabels: Record<string, string>) => string }[] = [
  { label: '자산번호', value: asset => asset.assetNumber },
  { label: '장비명', value: asset => asset.name },
  { label: '모델', value: asset => asset.model },
  { label: '분류', value: asset => asset.category },
  { label: '보관 위치', value: asset => asset.location },
  { label: '상태', value: (asset, statusLabels) => statusLabels[asset.status] || asset.status },
]

// 스프레드시트가 수식으로 해석하는 시작 문자는 작은따옴표를 붙여 글자로 남긴다.
function cell(value: string) {
  const text = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toAssetsCsv(assets: ExportableAsset[], statusLabels: Record<string, string>) {
  const rows = [columns.map(column => column.label), ...assets.map(asset => columns.map(column => column.value(asset, statusLabels)))]
  return '﻿' + rows.map(row => row.map(cell).join(',') + '\r\n').join('')
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function ExportAssetsCsv({ assets, statusLabels, disabled }: { assets: ExportableAsset[]; statusLabels: Record<string, string>; disabled: boolean }) {
  function download() {
    const url = URL.createObjectURL(new Blob([toAssetsCsv(assets, statusLabels)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `전체장비_${today()}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return <button className="export-assets-csv" disabled={disabled || assets.length === 0} onClick={download}>전체 장비 CSV</button>
}
