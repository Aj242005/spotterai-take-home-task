from datetime import datetime, timedelta
import math

class HOSEngine:
    """
    FMCSA Hours of Service (HOS) Simulation Engine for Property-Carrying Drivers (70-hr / 8-day cycle).
    
    Enforces:
    - 11-Hour Driving Limit per shift
    - 14-Hour Consecutive Duty Window per shift
    - 30-Minute Rest Break after 8 consecutive driving hours
    - 70-Hour / 8-Day Rolling Duty Limit (triggers 34-hour restart if exceeded)
    - Mandatory Fuel Stops every 1,000 miles (30 min On-Duty Not Driving)
    - Pickup & Dropoff Duty (1 hour each On-Duty Not Driving)
    - 10-Hour Mandatory Off-Duty / Sleeper Berth Rest between shifts
    """

    SPEED_MPH = 55.0  # Standard average truck speed including traffic
    FUEL_INTERVAL_MILES = 1000.0  # Fuel required every 1,000 miles

    @classmethod
    def calculate_trip_schedule(cls, trip_data: dict) -> dict:
        """
        Main calculation entry point.
        
        trip_data = {
            'current_location': str,
            'pickup_location': str,
            'dropoff_location': str,
            'current_cycle_hours': float, (0-70)
            'start_time': datetime (default current time or 06:00 AM today),
            'route_info': dict (from RouteService)
        }
        """
        start_dt = trip_data.get('start_time') or datetime.now().replace(hour=6, minute=0, second=0, microsecond=0)
        current_cycle_hours = float(trip_data.get('current_cycle_hours', 0.0))
        
        current_loc = trip_data['current_location']
        pickup_loc = trip_data['pickup_location']
        dropoff_loc = trip_data['dropoff_location']
        
        route_info = trip_data['route_info']
        total_miles = route_info['total_distance_miles']
        geometry = route_info['geometry']
        
        # We simulate chronologically and build a list of time-stamped events
        events = []
        stops = []
        
        current_time = start_dt
        cycle_hours = current_cycle_hours
        
        # State tracking within shift and rolling cycle
        state = {
            'shift_drive': 0.0,
            'shift_duty': 0.0,
            'drive_break': 0.0,
            'dist_fuel': 0.0,
            'cycle_hours': current_cycle_hours,
            # Odometer reading for the trip, used to place each stop on the map
            # at the mile it actually happens at.
            'miles_driven': 0.0
        }

        # Helper function to append events
        def add_event(status, duration_hrs, loc_name, description):
            nonlocal current_time
            
            start = current_time
            end = current_time + timedelta(hours=duration_hrs)
            
            # Update duty counters
            state['shift_duty'] += duration_hrs
            if status == 'driving':
                state['shift_drive'] += duration_hrs
                state['drive_break'] += duration_hrs
                state['cycle_hours'] += duration_hrs
            elif status == 'on_duty_not_driving':
                state['cycle_hours'] += duration_hrs
            elif status in ['off_duty', 'sleeper_berth']:
                # 10 consecutive hours resets shift counters
                if duration_hrs >= 10.0:
                    state['shift_drive'] = 0.0
                    state['shift_duty'] = 0.0
                # 34 consecutive hours resets 70-hr cycle
                if duration_hrs >= 34.0:
                    state['cycle_hours'] = 0.0

            # 49 CFR 395.3(a)(3)(ii): the 30-minute break is satisfied by ANY
            # consecutive non-driving period of 30+ minutes, not only off-duty
            # time. Fueling, loading, unloading and inspections all count, so
            # they must reset the 8-hour driving clock.
            if status != 'driving' and duration_hrs >= 0.5:
                state['drive_break'] = 0.0

            events.append({
                'status': status,
                'start_time': start,
                'end_time': end,
                'duration_hours': round(duration_hrs, 2),
                'location': loc_name,
                'description': description
            })
            current_time = end

        # 1. Pre-Trip Inspection & Start Duty (0.5 hrs at current location)
        add_event('on_duty_not_driving', 0.5, current_loc, 'Pre-trip inspection & log initialization')

        # 2. Drive to Pickup (Leg 1)
        # A zero-mile route genuinely has no driving to log, so it must not
        # fabricate a 50-mile deadhead that then shows up on the driver's sheet.
        leg1_miles = min(150.0, total_miles * 0.15) if total_miles > 0 else 0.0
        leg1_drive_hrs = leg1_miles / cls.SPEED_MPH
        
        # Simulate Leg 1 driving with HOS checks
        cls._simulate_driving(
            leg1_miles, leg1_drive_hrs, current_loc, pickup_loc,
            add_event, stops, state
        )

        # 3. Pickup Duty (1.0 hr On Duty Not Driving)
        add_event('on_duty_not_driving', 1.0, pickup_loc, 'Loading cargo at pickup location')
        stops.append({
            'type': 'pickup',
            'location_name': pickup_loc,
            'arrival_time': (current_time - timedelta(hours=1.0)).strftime('%Y-%m-%d %H:%M'),
            'departure_time': current_time.strftime('%Y-%m-%d %H:%M'),
            'duration_hours': 1.0,
            'cumulative_miles': round(state['miles_driven'], 1),
            'reason': 'Cargo loading & paperwork'
        })

        # 4. Main Transport Drive (Leg 2: Pickup to Dropoff)
        leg2_miles = max(0.0, total_miles - leg1_miles)
        leg2_drive_hrs = leg2_miles / cls.SPEED_MPH
        
        cls._simulate_driving(
            leg2_miles, leg2_drive_hrs, pickup_loc, dropoff_loc,
            add_event, stops, state
        )

        # 5. Dropoff Duty (1.0 hr On Duty Not Driving)
        add_event('on_duty_not_driving', 1.0, dropoff_loc, 'Unloading cargo at dropoff location')
        stops.append({
            'type': 'dropoff',
            'location_name': dropoff_loc,
            'arrival_time': (current_time - timedelta(hours=1.0)).strftime('%Y-%m-%d %H:%M'),
            'departure_time': current_time.strftime('%Y-%m-%d %H:%M'),
            'duration_hours': 1.0,
            'cumulative_miles': round(state['miles_driven'], 1),
            'reason': 'Cargo unloading & receiver sign-off'
        })

        # 6. Post-Trip Inspection (0.5 hrs Off-duty/On-duty)
        add_event('off_duty', 0.5, dropoff_loc, 'Post-trip inspection & shift wrap-up')

        # Partition timeline into daily logs (midnight to midnight).
        # This pass splits events that straddle midnight by rewriting list
        # entries, so it receives copies: the canonical `events` stream is the
        # source for the summary and the API payload below, and letting it be
        # truncated silently under-reported total driving hours for any trip
        # that crossed 00:00.
        daily_logs = cls._partition_into_daily_logs(
            [dict(event) for event in events], start_dt, total_miles
        )

        total_duration = (current_time - start_dt).total_seconds() / 3600.0
        total_driving = sum(e['duration_hours'] for e in events if e['status'] == 'driving')
        num_rest_stops = len([s for s in stops if s['type'] == 'rest'])
        num_fuel_stops = len([s for s in stops if s['type'] == 'fuel'])

        # Prepare JSON-safe events list with string timestamps
        json_events = []
        for e in events:
            json_events.append({
                'status': e['status'],
                'start_time': e['start_time'].strftime('%Y-%m-%d %H:%M') if isinstance(e['start_time'], datetime) else str(e['start_time']),
                'end_time': e['end_time'].strftime('%Y-%m-%d %H:%M') if isinstance(e['end_time'], datetime) else str(e['end_time']),
                'duration_hours': e['duration_hours'],
                'location': e['location'],
                'description': e['description']
            })

        return {
            'summary': {
                'total_distance_miles': total_miles,
                'total_duration_hours': round(total_duration, 1),
                'total_driving_hours': round(total_driving, 1),
                'num_days': len(daily_logs),
                'num_rest_stops': num_rest_stops,
                'num_fuel_stops': num_fuel_stops,
                'final_cycle_hours': round(state['cycle_hours'], 1),
                'start_time': start_dt.strftime('%Y-%m-%d %H:%M'),
                'end_time': current_time.strftime('%Y-%m-%d %H:%M'),
            },
            'events': json_events,
            'daily_logs': daily_logs,
            'stops': stops,
            'geometry': geometry
        }

    @classmethod
    def _simulate_driving(cls, distance_miles, driving_hrs_needed, start_loc, end_loc,
                          add_event_func, stops_list, state):
        """Chunk driving into small segments and enforce HOS limits dynamically."""
        remaining_miles = distance_miles
        remaining_drive_hrs = driving_hrs_needed

        while remaining_drive_hrs > 0.001:
            # Determine maximum driving chunk allowed before hitting a rule limit
            # 1. 11-Hour Driving Limit per shift
            max_drive_11 = max(0.0, 11.0 - state['shift_drive'])
            # 2. 14-Hour Duty Window limit
            max_drive_14 = max(0.0, 14.0 - state['shift_duty'])
            # 3. 30-Minute Rest Break limit (8 hours driving)
            max_drive_30m = max(0.0, 8.0 - state['drive_break'])
            # 4. 70-Hour Cycle limit
            max_drive_70 = max(0.0, 70.0 - state['cycle_hours'])
            # 5. Fuel interval limit (miles to next fuel / speed)
            miles_to_fuel = max(0.0, cls.FUEL_INTERVAL_MILES - state['dist_fuel'])
            max_drive_fuel = miles_to_fuel / cls.SPEED_MPH

            # Find the tightest constraint
            limits = [
                ('rest_10', max_drive_11),
                ('rest_10', max_drive_14),
                ('break_30', max_drive_30m),
                ('restart_34', max_drive_70),
                ('fuel', max_drive_fuel),
                ('destination', remaining_drive_hrs)
            ]
            
            # Sort limits by smallest allowed duration
            limits.sort(key=lambda x: x[1])
            reason, chunk_hrs = limits[0]

            if chunk_hrs > 0.001:
                # Drive the allowed chunk
                chunk_miles = chunk_hrs * cls.SPEED_MPH
                add_event_func('driving', chunk_hrs, f"En route to {end_loc}", f"Driving ({round(chunk_miles, 1)} mi)")
                
                remaining_drive_hrs -= chunk_hrs
                remaining_miles -= chunk_miles
                state['dist_fuel'] += chunk_miles
                state['miles_driven'] += chunk_miles

            # If we hit a constraint before reaching destination, execute required stop
            if remaining_drive_hrs > 0.001:
                if reason == 'break_30':
                    # 30-Minute Rest Break
                    add_event_func('off_duty', 0.5, f"Rest Area near {end_loc}", "30-minute mandatory rest break")

                elif reason in ['rest_10', '11_limit', '14_limit']:
                    # 10-Hour Mandatory Rest
                    add_event_func('sleeper_berth', 10.0, f"Truck Stop near {end_loc}", "10-hour mandatory shift rest break")
                    stops_list.append({
                        'type': 'rest',
                        'location_name': f"Rest Plaza / Truck Stop near {end_loc}",
                        'arrival_time': "During transit",
                        'departure_time': "Post 10-hr rest",
                        'duration_hours': 10.0,
                        'cumulative_miles': round(state['miles_driven'], 1),
                        'reason': "10-hour mandatory shift reset (11hr drive / 14hr duty limit reached)"
                    })

                elif reason == 'restart_34':
                    # 34-Hour Restart due to 70-hr cycle exhaustion
                    add_event_func('off_duty', 34.0, f"Terminal Rest near {end_loc}", "34-hour cycle restart (70-hr limit reached)")
                    stops_list.append({
                        'type': 'rest',
                        'location_name': f"Terminal Rest near {end_loc}",
                        'arrival_time': "During transit",
                        'departure_time': "Post 34-hr restart",
                        'duration_hours': 34.0,
                        'cumulative_miles': round(state['miles_driven'], 1),
                        'reason': "34-hour cycle restart (70-hr / 8-day limit reached)"
                    })

                elif reason == 'fuel':
                    # Fuel Stop (30 min On Duty Not Driving)
                    add_event_func('on_duty_not_driving', 0.5, "Travel Plaza (Fuel Station)", "Fueling truck & pre-trip check (1,000 mi interval)")
                    stops_list.append({
                        'type': 'fuel',
                        'location_name': "Travel Plaza / Fuel Station",
                        'arrival_time': "Fuel Stop",
                        'departure_time': "Post Fuel",
                        'duration_hours': 0.5,
                        'cumulative_miles': round(state['miles_driven'], 1),
                        'reason': "Mandatory 1,000-mile fuel stop"
                    })
                    state['dist_fuel'] = 0.0


    @staticmethod
    def _minutes_to_hmm(minutes: int) -> str:
        """Inverse of `_hmm_to_minutes`, clamped to the 00:00-24:00 log scale."""
        minutes = max(0, min(24 * 60, int(minutes)))
        return f"{minutes // 60:02d}:{minutes % 60:02d}"

    @classmethod
    def _partition_into_daily_logs(cls, events: list, start_dt: datetime, total_miles: float) -> list:
        """
        Split event stream into 24-hour daily logs (Midnight to Midnight).
        Guarantees that each day sums to exactly 24.0 hours across the 4 statuses.
        """
        if not events:
            return []

        daily_logs = []
        day_num = 1
        
        # Determine initial day start (00:00:00 of the start date)
        curr_day_start = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        curr_day_end = curr_day_start + timedelta(days=1)

        day_events = []
        event_idx = 0
        
        # Track previous 7 days on-duty total for recap table
        recap_history = [8.0, 7.5, 9.0, 6.0, 8.5, 7.0, 0.0]

        while event_idx < len(events):
            event = events[event_idx]
            ev_start = event['start_time']
            ev_end = event['end_time']
            status = event['status']
            location = event['location']
            description = event['description']

            # If event starts on or after curr_day_end, close current day log and advance day
            if ev_start >= curr_day_end:
                cls._finalize_day_log(daily_logs, day_num, curr_day_start, day_events, total_miles, recap_history)
                day_num += 1
                curr_day_start = curr_day_end
                curr_day_end = curr_day_start + timedelta(days=1)
                day_events = []
                continue

            # Event falls partially or fully in current day
            effective_end = min(ev_end, curr_day_end)
            duration_hrs = (effective_end - ev_start).total_seconds() / 3600.0

            day_events.append({
                'status': status,
                'start_time': ev_start.strftime('%H:%M'),
                'end_time': effective_end.strftime('%H:%M'),
                'duration_hours': round(duration_hrs, 2),
                'location': location,
                'description': description
            })

            # If event extends into next day, truncate current and push remainder back to queue
            if ev_end > curr_day_end:
                events[event_idx] = {
                    'status': status,
                    'start_time': curr_day_end,
                    'end_time': ev_end,
                    'duration_hours': (ev_end - curr_day_end).total_seconds() / 3600.0,
                    'location': location,
                    'description': description
                }
                cls._finalize_day_log(daily_logs, day_num, curr_day_start, day_events, total_miles, recap_history)
                day_num += 1
                curr_day_start = curr_day_end
                curr_day_end = curr_day_start + timedelta(days=1)
                day_events = []
            else:
                event_idx += 1

        # Finalize last day
        if day_events:
            cls._finalize_day_log(daily_logs, day_num, curr_day_start, day_events, total_miles, recap_history)

        return daily_logs

    DAY_MINUTES = 24 * 60

    @staticmethod
    def _hmm_to_minutes(value) -> int:
        """Convert a 'HH:MM' clock label used inside a daily log into minutes past midnight."""
        parts = str(value).split(':')
        return int(parts[0]) * 60 + int(parts[1])

    @classmethod
    def _finalize_day_log(cls, daily_logs, day_num, day_start_dt, day_events, total_miles, recap_history):
        """Calculate totals, grid lines, remarks, and recap for a single 24-hr day."""
        totals = {
            'off_duty': 0.0,
            'sleeper_berth': 0.0,
            'driving': 0.0,
            'on_duty_not_driving': 0.0
        }

        # The daily grid must account for all 1,440 minutes of the day as
        # contiguous segments. Padding only the leading gap left a hole after
        # the last event of any day the trip did not fill, which the recap then
        # silently absorbed into off-duty: the totals said 24.0 hours while the
        # drawn polyline stopped short and never reached the right edge.
        filled = []
        cursor = 0
        for ev in day_events:
            start_min = cls._hmm_to_minutes(ev['start_time'])
            # A segment ending at '00:00' ends at the day boundary, not at
            # minute zero, so it closes the grid instead of reopening it.
            end_min = cls._hmm_to_minutes(ev['end_time'])
            if end_min <= start_min and start_min > 0:
                end_min = cls.DAY_MINUTES

            if start_min > cursor:
                filled.append({
                    'status': 'off_duty',
                    'start_time': cls._minutes_to_hmm(cursor),
                    'end_time': ev['start_time'],
                    'duration_hours': round((start_min - cursor) / 60.0, 2),
                    'location': ev.get('location', 'Terminal'),
                    'description': 'Off duty (rest/overnight)'
                })
            filled.append(ev)
            cursor = max(cursor, end_min)

        if cursor < cls.DAY_MINUTES:
            filled.append({
                'status': 'off_duty',
                'start_time': cls._minutes_to_hmm(cursor),
                'end_time': '24:00',
                'duration_hours': round((cls.DAY_MINUTES - cursor) / 60.0, 2),
                'location': filled[-1].get('location', 'Terminal') if filled else 'Terminal',
                'description': 'Off duty (rest/overnight)'
            })

        day_events = filled

        # Sum totals
        for ev in day_events:
            st = ev['status']
            if st in totals:
                totals[st] += ev['duration_hours']

        # Rounding each segment to 2dp can leave the day a hundredth of an hour
        # short or long. Absorb that residue into the final segment so both the
        # totals and the drawn event stream sum to exactly 24.0.
        residue = round(24.0 - sum(totals.values()), 2)
        if residue and day_events:
            last = day_events[-1]
            last['duration_hours'] = round(last['duration_hours'] + residue, 2)
            totals[last['status']] += residue

        # Build remarks
        remarks = []
        for ev in day_events:
            if ev['status'] != 'off_duty' or ev['duration_hours'] > 1.0:
                remarks.append({
                    'time': ev['start_time'],
                    'location': ev['location'],
                    'remarks': f"{ev['description']} ({ev['duration_hours']} hrs)"
                })

        # Calculate 70-hr/8-day recap table
        on_duty_today = totals['driving'] + totals['on_duty_not_driving']
        prev_7_days_total = sum(recap_history[-7:])
        total_8_days = prev_7_days_total + on_duty_today
        available_tomorrow = max(0.0, 70.0 - total_8_days)

        # Update rolling recap history for next day
        recap_history.append(on_duty_today)

        daily_logs.append({
            'day_number': day_num,
            'date_str': day_start_dt.strftime('%B %d, %Y'),
            'total_miles': round(totals['driving'] * cls.SPEED_MPH, 1),
            'totals': {
                'off_duty': round(totals['off_duty'], 2),
                'sleeper_berth': round(totals['sleeper_berth'], 2),
                'driving': round(totals['driving'], 2),
                'on_duty_not_driving': round(totals['on_duty_not_driving'], 2),
                'grand_total': 24.0
            },
            'events': day_events,
            'remarks': remarks,
            'recap': {
                'on_duty_today': round(on_duty_today, 2),
                'prev_7_days_total': round(prev_7_days_total, 2),
                'total_8_days': round(total_8_days, 2),
                'available_tomorrow': round(available_tomorrow, 2)
            }
        })
