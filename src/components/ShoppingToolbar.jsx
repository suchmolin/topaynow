import { useRef, useEffect } from 'react'

export default function ShoppingToolbar({
  filterOpen,
  onToggleFilter,
  filterQuery,
  onFilterChange,
  pickEditMode,
  onTogglePickEdit,
  /** Si es false, no se muestra el botón de editar (p. ej. pantalla Comprados). */
  showPickEditButton = true,
}) {
  const filterInputRef = useRef(null)

  useEffect(() => {
    if (!filterOpen) return
    const id = requestAnimationFrame(() => {
      filterInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [filterOpen])

  return (
    <>
      <div className="flex justify-end items-center gap-1 mb-1">
        <button
          type="button"
          onClick={onToggleFilter}
          className={`p-2.5 rounded-full border ${
            filterOpen
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-transparent text-gray-600 hover:bg-gray-100'
          }`}
          title="Filtrar"
          aria-label="Filtrar por nombre"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        </button>
        {showPickEditButton && (
          <button
            type="button"
            onClick={onTogglePickEdit}
            className={`p-2.5 rounded-full border ${
              pickEditMode
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-100'
            }`}
            title="Editar un artículo"
            aria-label="Editar un artículo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}
      </div>
      {filterOpen && (
        <input
          ref={filterInputRef}
          type="search"
          value={filterQuery}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filtrar por nombre"
          className="w-full px-3 py-2 mb-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
        />
      )}
    </>
  )
}
