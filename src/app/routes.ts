export type RouteId = 'home' | 'attendance' | 'inventory' | 'memo'

export const routes: RouteId[] = ['home', 'attendance', 'inventory', 'memo']

export const routeLabels: Record<RouteId, string> = {
  home: '홈',
  attendance: '취식체크',
  inventory: '부식재고',
  memo: '메모',
}
