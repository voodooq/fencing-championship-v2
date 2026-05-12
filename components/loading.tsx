/**
 * 加载状态组件
 *
 * 两种模式：
 * - 全屏模式（默认）：首次加载时使用，居中显示加载动画
 * - 内联模式：数据已有但正在刷新时使用，不阻塞用户操作
 */
export default function LoadingOverlay({ inline = false }: { inline?: boolean }) {
  if (inline) {
    // 内联模式：轻量提示，不阻塞交互
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 border-solid"></div>
          <p className="text-sm text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  // 全屏模式：首次加载
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-solid mx-auto"></div>
        <p className="mt-4 text-lg font-semibold text-center">加载中...</p>
      </div>
    </div>
  )
}
