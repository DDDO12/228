export interface ShoppingMemoItem {
  id: string
  name: string
  quantity?: string
  purpose?: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface DayMemo {
  date: string
  content: string
  shoppingItems?: ShoppingMemoItem[]
  updatedAt: string
}
