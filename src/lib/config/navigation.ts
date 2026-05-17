import {
  DashboardBrowsingIcon,
  UserGroupIcon,
  PiggyBankIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  FileStackIcon,
  RotateLeft01Icon,
  AnalyticsUpIcon,
  UserAdd01Icon,
  File01Icon,
  BarChartIcon,
  PrinterIcon,
  Wallet01Icon,
  Exchange01Icon,
  UserShield01Icon,
} from '@hugeicons/core-free-icons';

export interface NavItem {
  title: string;
  url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: DashboardBrowsingIcon },
    ]
  },
  {
    label: 'Master Data',
    items: [
      { title: 'Students', url: '/master-data/students', icon: UserGroupIcon },
      { title: 'Saving Plans', url: '/master-data/saving-plans', icon: PiggyBankIcon },
    ]
  },
  {
    label: 'Transactions',
    items: [
      { title: 'Deposits', url: '/transactions/deposits', icon: ArrowDown01Icon },
      { title: 'Withdrawals', url: '/transactions/withdrawals', icon: ArrowUp01Icon },
      { title: 'Transaction History', url: '/transactions/transaction-history', icon: FileStackIcon },
      { title: 'Reversal', url: '/transactions/reversal', icon: RotateLeft01Icon },
    ]
  },
  {
    label: 'Reports',
    items: [
      { title: 'Saving Plans Report', url: '/reports/saving-plans-report', icon: BarChartIcon },
    ]
  },
  {
    label: 'System',
    items: [
      { title: 'User Management', url: '/system/user-management', icon: UserShield01Icon },
    ]
  },
];
