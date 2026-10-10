/**
 * The four duty states, named in the map's own language.
 *
 * The row numbers are the ones printed on the paper log sheet (1 OFF DUTY through
 * 4 ON DUTY), and the meanings are the terrain colours each state is drawn with,
 * so the symbol table on the page and the sheet in the binder read as one system.
 */
export const DUTY_META = {
  off_duty: {
    row: 1,
    label: 'Off duty',
    legend: 'Runnable ground — white',
  },
  sleeper_berth: {
    row: 2,
    label: 'Sleeper berth',
    legend: 'Water — blue',
  },
  driving: {
    row: 3,
    label: 'Driving',
    legend: 'The course — reserved purple',
  },
  on_duty_not_driving: {
    row: 4,
    label: 'On duty, not driving',
    legend: 'Open land — yellow',
  },
};

/** Printed order, innermost duty row first, matching the paper sheet. */
export const DUTY_ORDER = [
  { key: 'off_duty', ...DUTY_META.off_duty },
  { key: 'sleeper_berth', ...DUTY_META.sleeper_berth },
  { key: 'driving', ...DUTY_META.driving },
  { key: 'on_duty_not_driving', ...DUTY_META.on_duty_not_driving },
];

export function rowNumberFor(status) {
  return DUTY_META[status]?.row ?? 1;
}
