import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <h2 className="text-xl font-semibold text-gray-700">页面未找到</h2>
        <p className="text-gray-600">您访问的运动项目不存在或页面不存在</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}
