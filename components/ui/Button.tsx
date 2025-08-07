import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const baseClasses = 'button'
    const variantClasses = {
      default: 'button-default',
      destructive: 'button-destructive',
      outline: 'button-outline',
      secondary: 'button-secondary',
      ghost: 'button-ghost',
      link: 'button-link'
    }
    const sizeClasses = {
      default: 'button-default-size',
      sm: 'button-sm',
      lg: 'button-lg',
      icon: 'button-icon'
    }

    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()

    return (
      <button
        className={classes}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button } 