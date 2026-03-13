export default function FAB({ onClick, label = 'Añadir', icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-4 bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))] z-40 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 active:scale-95 flex items-center justify-center safe-bottom"
      aria-label={label}
    >
      {icon || (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  )
}
