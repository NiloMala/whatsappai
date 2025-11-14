import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport, ToastAction } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // coerce title/description to safe strings to avoid Radix internals calling .trim on undefined
        const titleText = title === undefined || title === null ? "" : String(title);
        const descText = description === undefined || description === null ? "" : String(description);

        // action can be a React element or a simple object { label, onClick }
        let actionNode: React.ReactNode = null;
        if (React.isValidElement(action)) {
          actionNode = action;
        } else if (action && typeof action === "object") {
          const anyAct = action as any;
          if (anyAct.label || anyAct.onClick) {
            actionNode = (
              <ToastAction asChild altText={anyAct.label || "Ação"}>
                <button onClick={anyAct.onClick}>{anyAct.label || "Action"}</button>
              </ToastAction>
            );
          }
        }

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {titleText ? <ToastTitle>{titleText}</ToastTitle> : null}
              {descText ? <ToastDescription>{descText}</ToastDescription> : null}
            </div>
            {actionNode}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
