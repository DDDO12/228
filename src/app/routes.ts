export type RouteId = 'home' | 'attendance' | 'officer' | 'inventory' | 'memo'

export const routes: RouteId[] = ['home', 'attendance', 'officer', 'inventory', 'memo']

export const routeLabels: Record<RouteId, string> = {
  home: '홈',
  attendance: '취식체크',
  officer: '식권구매자',
  inventory: '부식재고',
  memo: '메모',
}
