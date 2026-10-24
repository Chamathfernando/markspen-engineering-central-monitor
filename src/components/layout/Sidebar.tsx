import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  UserCheck,
  CalendarDays,
  Package,
  Wrench,
  Receipt,
  CheckCircle,
  Users,
  ClipboardList,
  Database,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  Palette
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenAppearanceModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  onOpenAppearanceModal
}) => {
  const location = useLocation();

  type NavItem = {
    name: string;
    icon: React.ElementType;
    href?: string;
    isAction?: boolean;
    onClick?: () => void;
  };

  const navGroups: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'Analytics & Data',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Quick Reports', href: '/quick-reports', icon: ClipboardList },
        { name: 'Manage Employees', href: '/employees', icon: Users },
        { name: 'Spare Parts', href: '/spare-parts', icon: Package }
      ]
    },
    {
      title: 'Operations',
      items: [
        { name: 'Jobs', href: '/jobs', icon: Briefcase },
        { name: 'Technicians Assigned', href: '/technicians-assigned', icon: UserCheck },
        { name: 'Technician Visits', href: '/technician-visits', icon: CalendarDays },
        { name: 'Spare Parts Used', href: '/spare-parts-used', icon: Wrench },
        { name: 'Expenses', href: '/expenses', icon: Receipt },
        { name: 'Job Closing', href: '/job-closing', icon: CheckCircle }
      ]
    },
    {
      title: 'Settings',
      items: [
        {
          name: 'Appearance',
          icon: Palette,
          isAction: true,
          onClick: onOpenAppearanceModal
        },
        {
          name: 'Workbook Status',
          href: '/settings',
          icon: Database
        }
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 shrink-0">
            <Layers className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold text-white tracking-tight leading-tight">
                Markspen Central
              </span>
              <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                Engineering Monitor
              </span>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links grouped by categories */}
      <div className="flex-1 py-3 px-2 space-y-5 overflow-y-auto">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
            )}
            {isCollapsed && groupIdx > 0 && (
              <div className="my-2 border-t border-slate-800" />
            )}
            {group.items.map(item => {
              const Icon = item.icon;

              if (item.isAction) {
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      onCloseMobile();
                      item.onClick?.();
                    }}
                    title={isCollapsed ? item.name : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group cursor-pointer text-slate-400 hover:text-slate-100 hover:bg-slate-800/80
                      ${isCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 text-slate-400 group-hover:text-slate-200" />
                    {!isCollapsed && (
                      <div className="flex items-center justify-between flex-1 truncate">
                        <span className="truncate">{item.name}</span>
                        <span className="text-[9px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                          Modal
                        </span>
                      </div>
                    )}
                  </button>
                );
              }

              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href!}
                  onClick={onCloseMobile}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group
                    ${isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                    }
                    ${isCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer / Excel Live Badge */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-300">Excel Data Store</span>
                <span className="text-[9px] text-slate-500">Root: .xlsx Synced</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 hidden lg:block cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 hidden lg:block cursor-pointer"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-800 transition-all duration-300 ease-in-out z-30
          ${isCollapsed ? 'w-18' : 'w-64'}`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
