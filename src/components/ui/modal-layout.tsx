import * as React from 'react';

/** Keep form ownership and submit handlers intact while isolating the scrollable body. */
export function ModalLayout({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).flatMap(child =>
    React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment
      ? React.Children.toArray(child.props.children) : [child]);
  const isEdge = (child: React.ReactNode) => React.isValidElement(child) &&
    /(?:Dialog|Sheet|Drawer)(?:Header|Footer)/.test((child.type as { displayName?: string }).displayName ?? '');
  const containsEdge = (child: React.ReactNode): boolean => React.isValidElement<{ children?: React.ReactNode }>(child) &&
    (isEdge(child) || React.Children.toArray(child.props.children).some(containsEdge));
  const result: React.ReactNode[] = [];
  let body: React.ReactNode[] = [];
  const flush = () => { if (body.length) { result.push(<div key={`body-${result.length}`} className="modal-scroll-body">{body}</div>); body = []; } };
  for (const child of items) {
    if (isEdge(child)) { flush(); result.push(child); }
    else if (React.isValidElement<{ children?: React.ReactNode; className?: string }>(child) &&
      typeof child.type === 'string' && containsEdge(child)) {
      flush();
      result.push(React.cloneElement(child, { className: `${child.props.className ?? ''} modal-layout-branch`, children: <ModalLayout>{child.props.children}</ModalLayout> }));
    } else body.push(child);
  }
  flush();
  return <>{result}</>;
}