class LogGenerator:
    """
    Transforms HOS Engine daily logs into pixel/grid coordinates and text metadata
    ready for frontend HTML5 canvas rendering.
    """

    STATUS_ROW_MAP = {
        'off_duty': 1,             # Row 1: Off Duty
        'sleeper_berth': 2,        # Row 2: Sleeper Berth
        'driving': 3,              # Row 3: Driving
        'on_duty_not_driving': 4   # Row 4: On Duty (Not Driving)
    }

    @classmethod
    def format_log_for_canvas(cls, daily_log: dict, trip_meta: dict) -> dict:
        """
        Converts daily log event intervals into continuous polyline vertices (x1, y1) -> (x2, y2).
        x axis: 0.0 to 24.0 hours
        y axis: row 1 to row 4
        """
        events = daily_log.get('events', [])
        grid_lines = []

        last_row = None
        last_time_hrs = 0.0

        for event in events:
            status = event['status']
            row = cls.STATUS_ROW_MAP.get(status, 1)

            # Parse start and end times in hours (0.0 to 24.0)
            start_parts = [int(p) for p in event['start_time'].split(':')]
            end_parts = [int(p) for p in event['end_time'].split(':')]
            
            start_hrs = start_parts[0] + start_parts[1] / 60.0
            end_hrs = end_parts[0] + end_parts[1] / 60.0
            if end_hrs == 0.0 and end_parts[0] == 0:
                end_hrs = 24.0

            # If status changed from previous event, draw vertical transition line at start_hrs
            if last_row is not None and last_row != row:
                grid_lines.append({
                    'type': 'vertical',
                    'time_hours': start_hrs,
                    'from_row': last_row,
                    'to_row': row
                })

            # Draw horizontal status line from start_hrs to end_hrs
            grid_lines.append({
                'type': 'horizontal',
                'row': row,
                'status': status,
                'start_hours': start_hrs,
                'end_hours': end_hrs,
                'duration_hours': event['duration_hours']
            })

            last_row = row
            last_time_hrs = end_hrs

        return {
            'header': {
                'date': daily_log['date_str'],
                'driver_name': trip_meta.get('driver_name', 'John Driver'),
                'carrier_name': trip_meta.get('carrier_name', 'Spotter Transport LLC'),
                'main_office_address': trip_meta.get('main_office_address', '100 Logistics Way, Chicago, IL'),
                'home_terminal_address': trip_meta.get('home_terminal_address', '500 Transport Blvd, Dallas, TX'),
                'truck_number': trip_meta.get('truck_number', 'TRK-8801'),
                'trailer_number': trip_meta.get('trailer_number', 'TRL-9942'),
                'total_miles_today': daily_log['total_miles'],
                'from_city': trip_meta.get('current_location', ''),
                'to_city': trip_meta.get('dropoff_location', ''),
            },
            'grid_lines': grid_lines,
            'totals': daily_log['totals'],
            'remarks': daily_log['remarks'],
            'recap': daily_log['recap']
        }
