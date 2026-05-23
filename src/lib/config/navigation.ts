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
      { title: 'Dasbor', url: '/dashboard', icon: DashboardBrowsingIcon },
    ]
  },
  {
    label: 'Data Master',
    items: [
      { title: 'Siswa', url: '/master-data/students', icon: UserGroupIcon },
      { title: 'Program Tabungan', url: '/master-data/saving-plans', icon: PiggyBankIcon },
    ]
  },
  {
    label: 'Transaksi',
    items: [
      { title: 'Setoran', url: '/transactions/deposits', icon: ArrowDown01Icon },
      { title: 'Penarikan', url: '/transactions/withdrawals', icon: ArrowUp01Icon },
      { title: 'Riwayat Transaksi', url: '/transactions/transaction-history', icon: FileStackIcon },
      { title: 'Pembatalan', url: '/transactions/reversal', icon: RotateLeft01Icon },
    ]
  },
  {
    label: 'Laporan',
    items: [
      { title: 'Laporan Program Tabungan', url: '/reports/saving-plans-report', icon: BarChartIcon },
    ]
  },
  {
    label: 'Sistem',
    items: [
      { title: 'Manajemen Pengguna', url: '/system/user-management', icon: UserShield01Icon },
    ]
  },
];
