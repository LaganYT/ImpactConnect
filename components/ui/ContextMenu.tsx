'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ContextMenuProps {
  children: ReactNode
  items: Array<{
    label?: string
    icon?: ReactNode
    onClick?: () => void
    disabled?: boolean
    separator?: boolean
    danger?: boolean
  }>
  onOpen?: () => void
  onClose?: () => void
}

export function ContextMenu({ children, items, onOpen, onClose }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const openMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setPosition({
        x: event.clientX,
        y: event.clientY
      })
    }
    
    setIsOpen(true)
    onOpen?.()
  }

  const closeMenu = () => {
    setIsOpen(false)
    onClose?.()
  }

  const handleItemClick = (onClick: () => void) => {
    onClick()
    closeMenu()
  }

  return (
    <>
      <div ref={triggerRef} onContextMenu={openMenu}>
        {children}
      </div>
      
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{
            left: position.x,
            top: position.y,
            transform: 'translate(-50%, -100%) translateY(-8px)'
          }}
        >
          {items.map((item, index) => (
            <div key={index}>
              {item.separator ? (
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              ) : (
                <button
                  onClick={() => handleItemClick(item.onClick)}
                  disabled={item.disabled}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    item.danger ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
} 