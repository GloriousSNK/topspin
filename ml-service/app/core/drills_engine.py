"""
Drill & workout generation.

Real, rule-based logic (no model needed): a catalogue of drills, each tagged
with the flaws it addresses, plus a generator that turns a set of detected
flaws (from the clip analysis) into a periodised, prioritised practice session.

Each drill carries enough detail to actually run it on court: a focus line, the
step-by-step how-to, a single coaching cue to hold in your head, and a
progression for when it gets easy.

This is deliberately data-driven so the catalogue can grow without touching the
generator, and so a player can also request a workout by goal/level directly.
"""

from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import dataclass, field, asdict

# --- Drill catalogue -------------------------------------------------------
# Each drill targets zero or more flaw ids from the flaw library. Fields:
#   steps         - how to actually do it, in order
#   coaching_cue  - the one thing to feel/think while doing it
#   progression   - how to make it harder once it's grooved
DRILL_CATALOGUE = [
    {
        "id": "shadow_unit_turn", "name": "Shadow unit-turn timing",
        "addresses": ["late_preparation"], "category": "footwork",
        "intensity": "low", "equipment": "none",
        "focus": "Trigger the shoulder turn the instant the ball is struck.",
        "default_sets": 3, "default_reps": 12,
        "steps": [
            "Stand in your ready position and imagine a ball coming to your forehand.",
            "The moment you 'see' contact, snap your shoulders into a full unit turn.",
            "Set the racquet back and freeze for a beat, then reset and repeat.",
        ],
        "coaching_cue": "Shoulders first, hands come along for the ride.",
        "progression": "Have a partner call 'now' at random so you react instead of anticipate.",
    },
    {
        "id": "elbow_up_wall", "name": "Elbow-up wall rally",
        "addresses": ["low_elbow", "wrist_instability"], "category": "technique",
        "intensity": "medium", "equipment": "wall, balls",
        "focus": "Keep the elbow lifted and the wrist firm through contact.",
        "default_sets": 4, "default_reps": 20,
        "steps": [
            "Stand 4-5 m from a wall and start a controlled rally.",
            "On every shot, feel your hitting elbow stay up at shoulder height.",
            "Keep the wrist laid back and firm, no flicking at the ball.",
        ],
        "coaching_cue": "Elbow up, wrist quiet.",
        "progression": "Step closer to the wall to speed up the exchange and test the firm wrist.",
    },
    {
        "id": "front_foot_drive", "name": "Front-foot loading step-in",
        "addresses": ["open_stance_drift", "narrow_base"], "category": "footwork",
        "intensity": "medium", "equipment": "cones",
        "focus": "Load the back leg, then drive weight forward into the shot.",
        "default_sets": 3, "default_reps": 15,
        "steps": [
            "Set a cone to mark where your front foot should land.",
            "Coil onto the back leg as the feed comes, weight loaded.",
            "Step across onto the front foot and drive up and through the ball.",
        ],
        "coaching_cue": "Load back, drive forward.",
        "progression": "Add a live feed at varied depth so you load under real timing pressure.",
    },
    {
        "id": "finish_over_shoulder", "name": "Finish-over-shoulder feeds",
        "addresses": ["short_followthrough"], "category": "technique",
        "intensity": "medium", "equipment": "feeder/basket",
        "focus": "Exaggerate a full follow-through finishing above the shoulder.",
        "default_sets": 4, "default_reps": 18,
        "steps": [
            "Take slow basket feeds at a comfortable pace.",
            "Swing low to high and wrap the finish over your opposite shoulder.",
            "Hold the finish for a second on each ball to check it.",
        ],
        "coaching_cue": "Catch the racquet by your ear.",
        "progression": "Keep the full finish while gradually adding pace to the feed.",
    },
    {
        "id": "eyes_on_contact", "name": "Quiet-head contact hold",
        "addresses": ["head_drop"], "category": "perception",
        "intensity": "low", "equipment": "balls",
        "focus": "Hold your gaze on the contact zone a half-second after impact.",
        "default_sets": 3, "default_reps": 20,
        "steps": [
            "Take easy feeds and pick a spot where contact happens.",
            "Keep your eyes locked on that spot through and after the hit.",
            "Only look up to track the ball once the swing is finished.",
        ],
        "coaching_cue": "See the hit, then look up.",
        "progression": "Call out the ball's spin or seam to force even earlier visual pick-up.",
    },
    {
        "id": "contact_out_front", "name": "Contact-point spacing ladder",
        "addresses": ["early_contact"], "category": "timing",
        "intensity": "medium", "equipment": "cones, basket",
        "focus": "Meet the ball progressively further in front each set.",
        "default_sets": 4, "default_reps": 16,
        "steps": [
            "Place a cone where you want contact, out in front of your lead hip.",
            "Feed balls and try to strike level with the cone every time.",
            "Each set, nudge the cone slightly further forward.",
        ],
        "coaching_cue": "Catch it in front of your pocket.",
        "progression": "Move to a live rally and keep taking the ball early and in front.",
    },
    {
        "id": "split_step_react", "name": "Split-step reaction starts",
        "addresses": [], "category": "footwork",
        "intensity": "high", "equipment": "none",
        "focus": "Time the split step to the opponent's contact for explosive starts.",
        "default_sets": 5, "default_reps": 10,
        "steps": [
            "Bounce into a light split step as a partner or feeder strikes.",
            "Land on the balls of your feet, knees soft and ready.",
            "Explode two steps in the called direction, then reset.",
        ],
        "coaching_cue": "Land as they hit, not before.",
        "progression": "React to a real hitting partner instead of a pattern you already know.",
    },
    {
        "id": "spin_window", "name": "Topspin net-clearance window",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "rope/target, basket",
        "focus": "Land balls in a high-margin window 1-1.5 m over the net.",
        "default_sets": 4, "default_reps": 20,
        "steps": [
            "String a rope or aim above a target 1-1.5 m over the net.",
            "Brush up the back of the ball so it clears the window with margin.",
            "Count how many of 20 pass through cleanly and land deep.",
        ],
        "coaching_cue": "Air over the net is free margin.",
        "progression": "Raise the target and aim deeper as your streaks get longer.",
    },
    {
        "id": "spider_run", "name": "Spider-run court sprints",
        "addresses": [], "category": "movement",
        "intensity": "high", "equipment": "cones",
        "focus": "Touch five court spots and recover to centre as fast as you can.",
        "default_sets": 4, "default_reps": 6,
        "steps": [
            "Start at the centre mark. Sprint to touch each of five spots in turn.",
            "Recover to centre between every touch, staying low.",
            "Time a full circuit and try to beat it each round.",
        ],
        "coaching_cue": "Low turns, fast recovery.",
        "progression": "Add a racquet in hand and shadow a shot at each spot.",
    },
    {
        "id": "serve_toss_groove", "name": "Serve toss consistency",
        "addresses": [], "category": "serve",
        "intensity": "low", "equipment": "balls",
        "focus": "Place the toss on the same spot in front, no racquet, ten in a row.",
        "default_sets": 3, "default_reps": 15,
        "steps": [
            "No racquet. Toss and let the ball drop without catching it.",
            "Aim for it to land just inside the baseline, slightly in front.",
            "Groove ten tosses that land on the same coin-sized spot.",
        ],
        "coaching_cue": "Lift, don't throw, the toss.",
        "progression": "Add the racquet and only swing on tosses that hit the spot.",
    },
    {
        "id": "serve_leg_drive", "name": "Serve leg-drive loads",
        "addresses": ["narrow_base"], "category": "serve",
        "intensity": "medium", "equipment": "none",
        "focus": "Bend and drive up through the legs into a full extension.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Start your motion and bend both knees as the toss goes up.",
            "Drive up explosively so you finish tall, up on your toes.",
            "Land inside the court on your front foot, balanced.",
        ],
        "coaching_cue": "Down to load, up to hit.",
        "progression": "Serve live to targets while keeping the full leg drive.",
    },
    {
        "id": "kick_serve_brush", "name": "Kick-serve brush-up",
        "addresses": ["short_followthrough"], "category": "serve",
        "intensity": "medium", "equipment": "basket",
        "focus": "Brush low to high across the ball for spin and clearance.",
        "default_sets": 4, "default_reps": 15,
        "steps": [
            "Toss slightly over your head and to the left (for a righty).",
            "Brush up and across the back of the ball, 7-to-1 o'clock.",
            "Finish on the same side you started, letting spin do the work.",
        ],
        "coaching_cue": "Brush up the back, don't hit through.",
        "progression": "Aim the kick to jump into the backhand corner of the box.",
    },
    {
        "id": "volley_punch", "name": "Volley punch progression",
        "addresses": ["wrist_instability"], "category": "volley",
        "intensity": "medium", "equipment": "feeder/basket",
        "focus": "Short, firm punch out in front, no backswing.",
        "default_sets": 4, "default_reps": 20,
        "steps": [
            "Set up at the net with a continental grip.",
            "Meet each feed out in front with a short, firm punch.",
            "Keep the racquet head above the wrist, no backswing.",
        ],
        "coaching_cue": "Catch it in front, no takeback.",
        "progression": "Alternate forehand and backhand volleys off quicker feeds.",
    },
    {
        "id": "reflex_volley_wall", "name": "Reflex volley wall taps",
        "addresses": ["wrist_instability", "early_contact"], "category": "volley",
        "intensity": "high", "equipment": "wall, balls",
        "focus": "Rapid firm-wrist volleys close to the wall to sharpen hands.",
        "default_sets": 5, "default_reps": 15,
        "steps": [
            "Stand 2-3 m from a wall in a volley-ready position.",
            "Tap continuous volleys into the wall, minimal swing.",
            "Keep the racquet up and the wrist locked as the pace climbs.",
        ],
        "coaching_cue": "Quiet hands, quick feet.",
        "progression": "Step closer to the wall to force faster reactions.",
    },
    {
        "id": "crosscourt_rally", "name": "Cross-court consistency rally",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "partner",
        "focus": "Rally cross-court and count how many you keep in a row.",
        "default_sets": 4, "default_reps": 25,
        "steps": [
            "Rally only cross-court with a partner, both hitting the same diagonal.",
            "Give every ball height and margin over the net.",
            "Count your longest unbroken streak each set.",
        ],
        "coaching_cue": "Shape over the net, aim past the service line.",
        "progression": "Shrink the target to a cross-court corner box.",
    },
    {
        "id": "dtl_targets", "name": "Down-the-line targets",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "targets, basket",
        "focus": "Hit down the line into a corner target each rep.",
        "default_sets": 4, "default_reps": 18,
        "steps": [
            "Place a target in the deep down-the-line corner.",
            "Take feeds and change direction cleanly down the line.",
            "Keep the ball in front and drive through the target line.",
        ],
        "coaching_cue": "Get sideways, hit through the line.",
        "progression": "Change direction off a cross-court feed on the run.",
    },
    {
        "id": "depth_control", "name": "Depth-control zone",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "rope/targets, basket",
        "focus": "Land every ball behind the service line, deep in the court.",
        "default_sets": 4, "default_reps": 20,
        "steps": [
            "Mark a deep zone between the service line and baseline.",
            "Rally or feed, landing every ball inside that deep zone.",
            "Add net clearance so depth comes from shape, not pace.",
        ],
        "coaching_cue": "Deep and heavy beats hard and short.",
        "progression": "Narrow the deep zone to the last metre before the baseline.",
    },
    {
        "id": "figure_eight", "name": "Figure-8 rally",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "partner",
        "focus": "One hits cross-court, one down the line, keep it flowing.",
        "default_sets": 3, "default_reps": 30,
        "steps": [
            "One player hits only cross-court, the other only down the line.",
            "The ball traces a figure-8 pattern between you.",
            "Keep the rhythm going, then swap roles.",
        ],
        "coaching_cue": "Early prep — you always know where it's going.",
        "progression": "Raise the pace while holding the pattern together.",
    },
    {
        "id": "recovery_step", "name": "Recovery step-out",
        "addresses": ["open_stance_drift"], "category": "footwork",
        "intensity": "medium", "equipment": "cones",
        "focus": "Hit, then push off the outside foot to recover to centre.",
        "default_sets": 4, "default_reps": 14,
        "steps": [
            "Take a wide feed and set up in a balanced stance.",
            "After contact, push hard off the outside foot.",
            "Cross-step and shuffle back to the centre mark before the next feed.",
        ],
        "coaching_cue": "Hit and get home.",
        "progression": "Widen the feeds so recovery distance grows each set.",
    },
    {
        "id": "lateral_ladder", "name": "Lateral shuffle ladder",
        "addresses": [], "category": "footwork",
        "intensity": "medium", "equipment": "agility ladder",
        "focus": "Quick, low shuffles keeping your base wide and balanced.",
        "default_sets": 4, "default_reps": 10,
        "steps": [
            "Face the ladder sideways and shuffle through each rung.",
            "Stay low with a wide base, quick feet, no crossing over.",
            "Explode out of the last rung into two recovery steps.",
        ],
        "coaching_cue": "Low centre, fast feet.",
        "progression": "Finish each pass with a shadow swing and recovery.",
    },
    {
        "id": "unit_turn_racket", "name": "Unit-turn shadow with racquet",
        "addresses": ["late_preparation"], "category": "technique",
        "intensity": "low", "equipment": "racquet",
        "focus": "Turn shoulders and set the racquet back early, on repeat.",
        "default_sets": 3, "default_reps": 15,
        "steps": [
            "From ready position, turn your shoulders and hips together.",
            "Let your non-dominant hand guide the racquet back early.",
            "Pause at full coil, then unwind slowly and reset.",
        ],
        "coaching_cue": "Turn and point across with the free hand.",
        "progression": "Add a slow feed and keep the prep just as early under timing.",
    },
    {
        "id": "low_high_groove", "name": "Low-to-high topspin groove",
        "addresses": ["short_followthrough"], "category": "technique",
        "intensity": "medium", "equipment": "basket",
        "focus": "Start the racquet below the ball and finish high for topspin.",
        "default_sets": 4, "default_reps": 20,
        "steps": [
            "Drop the racquet head below the height of the incoming ball.",
            "Accelerate up the back of the ball, brushing for spin.",
            "Finish high and across, letting the topspin bring it down.",
        ],
        "coaching_cue": "Low to high, fast up the back.",
        "progression": "Add depth targets so spin still lands the ball deep.",
    },
    {
        "id": "slice_bevel", "name": "Slice bevel control",
        "addresses": [], "category": "technique",
        "intensity": "medium", "equipment": "basket",
        "focus": "Lead with the edge, cut high to low for a floating slice.",
        "default_sets": 4, "default_reps": 16,
        "steps": [
            "Set a continental grip and take the racquet up and back.",
            "Lead with the edge and cut down the back of the ball, high to low.",
            "Keep the follow-through long and out toward the target.",
        ],
        "coaching_cue": "Edge first, stay with the ball.",
        "progression": "Slice on the move and keep it skidding low and deep.",
    },
    {
        "id": "two_ball_reaction", "name": "Two-ball reaction feed",
        "addresses": ["head_drop"], "category": "perception",
        "intensity": "high", "equipment": "feeder/partner",
        "focus": "React to a quick second feed with eyes locked on the ball.",
        "default_sets": 4, "default_reps": 14,
        "steps": [
            "A partner feeds one ball, then a quick second at a different spot.",
            "Recover fast and keep your eyes tracking the second ball early.",
            "Reset to ready between each pair of feeds.",
        ],
        "coaching_cue": "Eyes to the next ball the instant you finish.",
        "progression": "Shorten the gap between the two feeds.",
    },
    {
        "id": "ball_readout", "name": "Ball-read call-out",
        "addresses": ["head_drop"], "category": "perception",
        "intensity": "low", "equipment": "partner",
        "focus": "Call spin or direction early to train visual pick-up.",
        "default_sets": 3, "default_reps": 20,
        "steps": [
            "As your partner strikes, call 'top', 'slice' or the direction out loud.",
            "Make the call before the ball crosses the net.",
            "Then play the shot normally.",
        ],
        "coaching_cue": "Read the racquet, not just the ball.",
        "progression": "Call the exact landing zone as well as the spin.",
    },
    {
        "id": "approach_close", "name": "Approach and close",
        "addresses": [], "category": "movement",
        "intensity": "medium", "equipment": "cones",
        "focus": "Approach off a short ball, split, and close the net.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Start at the baseline and move forward onto a short feed.",
            "Hit an approach deep, then split-step as you reach the service line.",
            "Close another step or two and punch the volley away.",
        ],
        "coaching_cue": "Approach deep, then keep coming.",
        "progression": "Have a partner try to pass you after the approach.",
    },
    {
        "id": "baseline_net_sprint", "name": "Baseline-to-net sprints",
        "addresses": [], "category": "movement",
        "intensity": "high", "equipment": "none",
        "focus": "Explode forward to the net and back-pedal to recover.",
        "default_sets": 5, "default_reps": 8,
        "steps": [
            "Start at the baseline and sprint forward to touch the net.",
            "Back-pedal under control to the baseline.",
            "Stay low and repeat without standing fully upright.",
        ],
        "coaching_cue": "Sprint in, glide back.",
        "progression": "Add a shadow volley at the net and split-step on the way back.",
    },
    {
        "id": "serve_plus_one", "name": "Serve-plus-one pattern",
        "addresses": ["early_contact"], "category": "timing",
        "intensity": "medium", "equipment": "basket",
        "focus": "Serve, then step in and take the next ball early.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Hit a serve to a target, then a partner or feeder returns.",
            "Step into the court and take the plus-one ball on the rise.",
            "Aim the plus-one to the open court.",
        ],
        "coaching_cue": "Serve, step in, take time away.",
        "progression": "Pre-call the plus-one target before you serve.",
    },
    {
        "id": "return_split_timing", "name": "Return split-step timing",
        "addresses": ["late_preparation"], "category": "timing",
        "intensity": "medium", "equipment": "partner",
        "focus": "Split as they toss, short backswing, block the return deep.",
        "default_sets": 4, "default_reps": 15,
        "steps": [
            "Split-step exactly as the server's ball toss peaks.",
            "Use a short, compact backswing — turn, don't wind up.",
            "Block or drive the return deep and down the middle.",
        ],
        "coaching_cue": "Small backswing, big body turn.",
        "progression": "Return first serves and second serves with different targets.",
    },
    {
        "id": "contact_wall_taps", "name": "Contact-point wall taps",
        "addresses": ["early_contact"], "category": "timing",
        "intensity": "low", "equipment": "wall, balls",
        "focus": "Control tempo against the wall, meeting the ball out front.",
        "default_sets": 3, "default_reps": 25,
        "steps": [
            "Rally against a wall at a slow, controlled tempo.",
            "Meet every ball out in front, adjusting your feet to the bounce.",
            "Keep the rhythm smooth and repeatable.",
        ],
        "coaching_cue": "Feet set the spacing, not the arm.",
        "progression": "Gradually stand closer to speed the tempo up.",
    },
    {
        "id": "core_rotation_med", "name": "Core rotation with med ball",
        "addresses": [], "category": "fitness",
        "intensity": "medium", "equipment": "medicine ball",
        "focus": "Rotational throws to build the coil and uncoil of a stroke.",
        "default_sets": 3, "default_reps": 12,
        "steps": [
            "Stand side-on to a wall holding a light medicine ball.",
            "Coil back like a groundstroke, then explode and throw across your body.",
            "Catch or reset and repeat, both sides.",
        ],
        "coaching_cue": "Power comes from the ground up through the core.",
        "progression": "Add a step-in so the throw mirrors a full stroke.",
    },
    {
        "id": "tempo_shadow", "name": "Shadow swings for tempo",
        "addresses": [], "category": "fitness",
        "intensity": "low", "equipment": "racquet",
        "focus": "Smooth, full-speed shadow swings to groove rhythm and balance.",
        "default_sets": 3, "default_reps": 20,
        "steps": [
            "Shadow your forehand and backhand at full, smooth speed.",
            "Include the split-step, unit turn, swing and recovery.",
            "Finish each swing balanced before the next.",
        ],
        "coaching_cue": "Smooth is fast; rhythm over effort.",
        "progression": "Chain two shadow swings and a recovery into one flowing rep.",
    },
    {
        "id": "grip_firm_holds", "name": "Firm-wrist grip holds",
        "addresses": ["wrist_instability"], "category": "technique",
        "intensity": "low", "equipment": "racquet",
        "focus": "Hold a firm contact position to feel a stable wrist.",
        "default_sets": 3, "default_reps": 15,
        "steps": [
            "Set the racquet at an imagined contact point out in front.",
            "Grip firmly and feel the wrist locked, not floppy.",
            "Hold for two seconds, relax, and reset.",
        ],
        "coaching_cue": "Firm at contact, relaxed everywhere else.",
        "progression": "Have a partner lightly push the strings to test the hold.",
    },
    {
        "id": "balance_finish", "name": "Balance-finish holds",
        "addresses": ["open_stance_drift"], "category": "technique",
        "intensity": "low", "equipment": "none",
        "focus": "Freeze the finish for two seconds to check your balance.",
        "default_sets": 3, "default_reps": 15,
        "steps": [
            "Shadow a groundstroke and hold your finish position.",
            "Balance for a full two seconds without a wobble.",
            "If you fall out of it, your base or weight transfer needs work.",
        ],
        "coaching_cue": "Land balanced, hold the pose.",
        "progression": "Hold the finish after a real feed on the move.",
    },

    # --- added drills ------------------------------------------------------
    {
        "id": "two_hand_bh_drive", "name": "Two-hander drive groove",
        "addresses": ["late_preparation", "short_followthrough"], "category": "technique",
        "intensity": "medium", "equipment": "basket",
        "focus": "Both hands drive low-to-high through a compact two-handed backhand.",
        "default_sets": 4, "default_reps": 18,
        "steps": [
            "Turn early and set both hands back together, non-dominant hand leading.",
            "Drive up through the ball, top hand pulling the finish.",
            "Finish with both hands wrapped over the shoulder.",
        ],
        "coaching_cue": "Non-dominant hand does the work.",
        "progression": "Change direction down the line without losing the compact turn.",
    },
    {
        "id": "one_hand_bh_carve", "name": "One-hander stability carve",
        "addresses": ["wrist_instability", "short_followthrough"], "category": "technique",
        "intensity": "medium", "equipment": "basket",
        "focus": "Lead with the shoulder and hold a stable one-handed backhand.",
        "default_sets": 4, "default_reps": 16,
        "steps": [
            "Turn side-on early and set the free hand back for balance.",
            "Drive from the shoulder, keeping the wrist and arm firm.",
            "Finish with the hitting arm up and the free arm back.",
        ],
        "coaching_cue": "Chest to the side fence, arm firm.",
        "progression": "Mix drive and slice off the same preparation.",
    },
    {
        "id": "inside_out_fh", "name": "Inside-out forehand pattern",
        "addresses": ["open_stance_drift"], "category": "consistency",
        "intensity": "medium", "equipment": "targets, basket",
        "focus": "Run around the backhand and drive the forehand inside-out.",
        "default_sets": 4, "default_reps": 14,
        "steps": [
            "Take a feed to your backhand corner and step around it.",
            "Set an open-to-neutral stance and drive the forehand cross to the ad corner.",
            "Recover quickly toward the middle after each ball.",
        ],
        "coaching_cue": "Run around it, then own the point.",
        "progression": "Add an inside-in option down the line to keep it honest.",
    },
    {
        "id": "second_serve_kick_targets", "name": "Second-serve kick targets",
        "addresses": ["short_followthrough"], "category": "serve",
        "intensity": "medium", "equipment": "targets, basket",
        "focus": "Hit repeatable, high-margin kick second serves into a target.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Place a target deep in the backhand half of the box.",
            "Toss over your head and brush up for a high, safe kick.",
            "Count how many of 12 land in the target with margin.",
        ],
        "coaching_cue": "Spin for safety, height for margin.",
        "progression": "Reduce the target size and add pressure of 'must make 8/12'.",
    },
    {
        "id": "first_serve_flat_targets", "name": "First-serve flat targets",
        "addresses": [], "category": "serve",
        "intensity": "medium", "equipment": "targets, basket",
        "focus": "Drive first serves to the T and wide targets for free points.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Set cones on the T and the wide corner of the box.",
            "Serve 6 to the T, 6 wide, driving up and through.",
            "Track your make percentage to each spot.",
        ],
        "coaching_cue": "Reach up and out to the target.",
        "progression": "Alternate T and wide on a partner's call, so you disguise it.",
    },
    {
        "id": "return_block_deep", "name": "Compact return blocks",
        "addresses": ["late_preparation", "early_contact"], "category": "timing",
        "intensity": "medium", "equipment": "partner",
        "focus": "Neutralise a big serve with a short, deep block return.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Take a wide stance and split-step on the serve toss.",
            "Turn the shoulders, almost no backswing, and meet the ball in front.",
            "Use the incoming pace to block it deep down the middle.",
        ],
        "coaching_cue": "Meet it, don't swing at it.",
        "progression": "Step in and drive the return once the block feels solid.",
    },
    {
        "id": "drop_shot_touch", "name": "Drop-shot touch feel",
        "addresses": ["wrist_instability"], "category": "technique",
        "intensity": "low", "equipment": "basket",
        "focus": "Soft hands and backspin to drop the ball just over the net.",
        "default_sets": 3, "default_reps": 15,
        "steps": [
            "Disguise it like a slice, then soften the grip at contact.",
            "Cut under the ball with a short, gentle stroke.",
            "Aim to land it inside the service line with backspin.",
        ],
        "coaching_cue": "Catch the ball on soft strings.",
        "progression": "Hit the drop off a deeper ball and follow it in.",
    },
    {
        "id": "lob_defense", "name": "Defensive lob recovery",
        "addresses": [], "category": "movement",
        "intensity": "medium", "equipment": "partner/feeder",
        "focus": "Turn defence into offence with a high, deep lob under pressure.",
        "default_sets": 3, "default_reps": 12,
        "steps": [
            "Chase a ball pulling you wide or back off the court.",
            "Get under it and lift a high, deep lob over the imagined net player.",
            "Recover to the middle and reset your position.",
        ],
        "coaching_cue": "High and deep buys you time.",
        "progression": "Lob, then sprint in to retake the net.",
    },
    {
        "id": "overhead_smash_reps", "name": "Overhead smash reps",
        "addresses": ["head_drop"], "category": "volley",
        "intensity": "high", "equipment": "feeder/partner",
        "focus": "Track the lob, set the feet, and put the overhead away.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Point up at the ball with the non-hitting hand and shuffle back.",
            "Set behind the ball, weight loaded, racquet in the throwing position.",
            "Reach up and snap the overhead into the open court.",
        ],
        "coaching_cue": "Point, shuffle, reach up.",
        "progression": "Take the overhead out of the air with a scissor kick.",
    },
    {
        "id": "half_volley_pickup", "name": "Half-volley pick-up",
        "addresses": ["early_contact"], "category": "volley",
        "intensity": "medium", "equipment": "feeder",
        "focus": "Absorb the low ball at your feet with a soft, short block.",
        "default_sets": 4, "default_reps": 16,
        "steps": [
            "Take feeds that bounce right at your feet as you move in.",
            "Bend the knees, racquet low, and pick the ball up just after the bounce.",
            "Keep the face slightly open and guide it deep.",
        ],
        "coaching_cue": "Bend the knees, soft block, no swing.",
        "progression": "Half-volley on the move while approaching the net.",
    },
    {
        "id": "serve_and_volley", "name": "Serve-and-volley pattern",
        "addresses": [], "category": "movement",
        "intensity": "high", "equipment": "partner",
        "focus": "Serve, close behind it, split-step and put the first volley away.",
        "default_sets": 4, "default_reps": 10,
        "steps": [
            "Hit the serve and move in behind it immediately.",
            "Split-step as the returner strikes, around the service line.",
            "Punch the first volley deep and close for the next.",
        ],
        "coaching_cue": "Serve, follow, split, punch.",
        "progression": "Aim the first volley behind the returner's recovery.",
    },
    {
        "id": "deep_middle_reset", "name": "Deep-middle reset ball",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "partner",
        "focus": "Neutralise pressure by resetting high and deep up the middle.",
        "default_sets": 3, "default_reps": 20,
        "steps": [
            "When pushed off the court, aim high and deep through the middle.",
            "Take pace off and add net clearance to buy recovery time.",
            "Recover to centre and re-engage the rally.",
        ],
        "coaching_cue": "Middle and deep kills their angle.",
        "progression": "Reset once, then look to step in and attack the next ball.",
    },
    {
        "id": "angle_dipper", "name": "Sharp-angle topspin dipper",
        "addresses": ["short_followthrough"], "category": "technique",
        "intensity": "high", "equipment": "targets, basket",
        "focus": "Heavy topspin to pull a sharp cross-court angle off the court.",
        "default_sets": 4, "default_reps": 14,
        "steps": [
            "Set a target in the short cross-court corner near the sideline.",
            "Brush up steeply and finish across your body for a dipping angle.",
            "Make the ball land short and kick away off the court.",
        ],
        "coaching_cue": "Fast racquet up, finish across.",
        "progression": "Open the angle further and follow it to the net.",
    },
    {
        "id": "carioca_footwork", "name": "Carioca crossover footwork",
        "addresses": ["narrow_base"], "category": "fitness",
        "intensity": "medium", "equipment": "none",
        "focus": "Hip-opening crossover steps to move wide and recover smoothly.",
        "default_sets": 4, "default_reps": 10,
        "steps": [
            "Move sideways using a grapevine crossover, front then back.",
            "Keep hips loose and the base wide and low.",
            "Finish each pass with a balanced shadow swing.",
        ],
        "coaching_cue": "Loose hips, wide base.",
        "progression": "Speed it up and add a recovery sprint to centre.",
    },
    {
        "id": "pressure_serve_game", "name": "Pressure serve game",
        "addresses": [], "category": "mental",
        "intensity": "medium", "equipment": "targets, balls",
        "focus": "Serve under a made-up scoreboard to train nerve, not just technique.",
        "default_sets": 3, "default_reps": 10,
        "steps": [
            "Play out serve-only games: you must make a first serve to a target to 'win' the point.",
            "Announce the score out loud so the pressure feels real.",
            "Reset your routine before every serve, especially on 'break points'.",
        ],
        "coaching_cue": "Same routine, every score.",
        "progression": "Add a consequence (sprints) for losing a game to raise the stakes.",
    },
    {
        "id": "rally_tolerance_100", "name": "Rally-tolerance 100",
        "addresses": [], "category": "mental",
        "intensity": "medium", "equipment": "partner",
        "focus": "Build patience and focus by rallying to a high, unbroken target.",
        "default_sets": 2, "default_reps": 50,
        "steps": [
            "Cooperative rally with a partner, aiming for 100 balls in a row.",
            "Any miss resets the count to zero — stay calm and rebuild.",
            "Keep good shape and depth even as the count climbs.",
        ],
        "coaching_cue": "One more ball, every ball.",
        "progression": "Add targets so the streak also has to be accurate.",
    },
    {
        "id": "poach_timing", "name": "Doubles poach timing",
        "addresses": ["late_preparation"], "category": "volley",
        "intensity": "medium", "equipment": "partner",
        "focus": "Read the return and move early to cut off the cross-court ball.",
        "default_sets": 4, "default_reps": 12,
        "steps": [
            "Start at the net and watch the returner's contact.",
            "As they commit cross-court, push off and cross to intercept.",
            "Punch the poach volley into the open court and continue across.",
        ],
        "coaching_cue": "Move on their contact, not before.",
        "progression": "Add a fake-and-hold to keep the returner guessing.",
    },
]

INTENSITY_MINUTES = {"low": 6, "medium": 9, "high": 12}


@dataclass
class PrescribedDrill:
    id: str
    name: str
    category: str
    focus: str
    sets: int
    reps: int
    intensity: str
    equipment: str
    targets: list[str]            # flaw labels this addresses for the user
    est_minutes: int
    priority: float               # higher = more important for this player
    coaching_cue: str = ""        # the one thing to feel while doing it
    steps: list[str] = field(default_factory=list)


@dataclass
class Workout:
    title: str
    goal: str
    level: str
    total_minutes: int
    drills: list[dict]
    notes: str

    def to_dict(self) -> dict:
        return asdict(self)


def _catalogue_by_flaw(flaw_id: str):
    return [d for d in DRILL_CATALOGUE if flaw_id in d["addresses"]]


def generate_from_flaws(
    flaws: list[dict],
    level: str = "intermediate",
    max_minutes: int = 45,
) -> Workout:
    """
    Turn detected flaws (each {id, label, severity, ...}) into a prioritised
    session. Highest-severity flaws get their drills first; we then top up with
    general consistency/footwork work until the time budget is filled.
    """
    level_mult = {"beginner": 0.8, "intermediate": 1.0, "advanced": 1.25}.get(level, 1.0)
    prescribed: list[PrescribedDrill] = []
    used_ids: set[str] = set()
    flaws_sorted = sorted(flaws, key=lambda f: f.get("severity", 0), reverse=True)

    for flaw in flaws_sorted:
        if not flaw.get("id"):
            continue
        for drill in _catalogue_by_flaw(flaw["id"]):
            if drill["id"] in used_ids:
                continue
            used_ids.add(drill["id"])
            sets = max(1, round(drill["default_sets"] * level_mult))
            prescribed.append(_prescribe(drill, sets, flaw, flaw.get("severity", 0.5)))

    # Top up with general-purpose drills (footwork/consistency).
    for drill in DRILL_CATALOGUE:
        if drill["id"] in used_ids or drill["addresses"]:
            continue
        used_ids.add(drill["id"])
        sets = max(1, round(drill["default_sets"] * level_mult))
        prescribed.append(_prescribe(drill, sets, None, 0.3))

    # Fill to time budget, highest priority first.
    prescribed.sort(key=lambda d: d.priority, reverse=True)
    session, total = [], 0
    for d in prescribed:
        if total + d.est_minutes > max_minutes and session:
            break
        session.append(d)
        total += d.est_minutes

    return Workout(
        title="Personalised practice session",
        goal="Address detected technical flaws + maintain general sharpness",
        level=level,
        total_minutes=total,
        drills=[asdict(d) for d in session],
        notes="Warm up 5 min. Rest 45-60 s between sets. Quality over speed.",
    )


def generate_by_goal(goal: str, level: str = "intermediate", max_minutes: int = 45) -> Workout:
    """Goal-based workout when there's no clip analysis (e.g. 'consistency')."""
    goal_categories = {
        "consistency": ["consistency", "technique", "perception", "mental"],
        "power": ["technique", "footwork", "fitness"],
        "footwork": ["footwork", "movement"],
        "serve": ["serve", "timing"],
        "volley": ["volley", "movement"],
        "mental": ["mental", "consistency", "perception"],
        "all_round": ["footwork", "technique", "consistency", "timing", "serve", "volley"],
    }
    cats = goal_categories.get(goal, ["footwork", "technique"])
    level_mult = {"beginner": 0.8, "intermediate": 1.0, "advanced": 1.25}.get(level, 1.0)

    chosen = [d for d in DRILL_CATALOGUE if d["category"] in cats]
    session, total = [], 0
    for drill in chosen:
        sets = max(1, round(drill["default_sets"] * level_mult))
        p = _prescribe(drill, sets, None, 0.5)
        if total + p.est_minutes > max_minutes and session:
            break
        session.append(p)
        total += p.est_minutes

    return Workout(
        title=f"{(goal or 'All-round').replace('_', ' ').title()} workout".strip(),
        goal=goal,
        level=level,
        total_minutes=total,
        drills=[asdict(d) for d in session],
        notes="Warm up 5 min. Track makes/misses to measure progress over weeks.",
    )


# --- Dynamic drill from a free-text goal -----------------------------------
# Rule-based (free, no keys, always works). Upgrades to a real free AI model
# (Google Gemini) automatically if GEMINI_API_KEY is set.

_GOAL_RULES = [
    (("serve", "ace", "first serve", "second serve"), "serve", "Serve targets & rhythm",
     ["Shadow the full motion 5x, feeling the leg drive and reach.",
      "Serve 10 balls to the T, then 10 wide — count makes.",
      "Add a target cone in each corner and hit 3 sets of 8."], "Toss consistent, reach up at contact."),
    (("volley", "net", "doubles"), "volley", "Punch-volley control",
     ["Wall or feeder: 20 firm-wrist punch volleys, no backswing.",
      "Alternate forehand/backhand volley, meeting the ball out front.",
      "Approach, split-step, and close for 3 sets of 10."], "Short and firm, contact in front."),
    (("backhand", "two-hand", "one-hand"), "technique", "Backhand groove",
     ["Shadow 10 unit turns, racquet set early.",
      "Feed 20 backhands low-to-high, finishing over the shoulder.",
      "Cross-court then down-the-line targets, 3 sets of 12."], "Turn early, drive through the ball."),
    (("forehand", "fh"), "technique", "Forehand groove",
     ["Shadow 10 unit turns and finishes.",
      "Feed 20 forehands, brushing up for topspin.",
      "Cross-court depth targets, 3 sets of 12."], "Load the legs, finish high."),
    (("spin", "topspin", "slice", "kick"), "technique", "Spin windows",
     ["Feed 15 balls low-to-high, exaggerating the brush.",
      "Aim 1–1.5 m over the net into a deep zone.",
      "Alternate topspin and slice for 3 sets of 12."], "Racquet-head speed low to high."),
    (("consistency", "rally", "control", "keep it in", "unforced"), "consistency", "Consistency ladder",
     ["Cross-court rally, count your longest streak.",
      "Reset after any miss; target 20 in a row.",
      "Down-the-line targets, 3 sets of 15."], "Big margin over the net, quality over pace."),
    (("footwork", "movement", "speed", "agility", "quick"), "footwork", "Movement circuit",
     ["Split-step reaction starts, 10 explosive first steps.",
      "Lateral shuffles wide-to-wide, staying low.",
      "Hit-and-recover to centre, 3 sets of 12."], "Small adjust steps, recover every ball."),
    (("power", "pace", "harder", "faster"), "power", "Power development",
     ["Med-ball rotational throws, 3 sets of 10.",
      "Load-and-drive step-ins on the forehand.",
      "Swing full-speed on 3 sets of 10, keep it in."], "Coil then uncoil, drive off the ground."),
    (("return", "returning"), "timing", "Return sharpening",
     ["Split-step on the toss, short compact backswing.",
      "Block deep cross-court, 3 sets of 10.",
      "Step in and take the next ball early."], "Read early, keep the return simple and deep."),
    (("nerves", "pressure", "mental", "choke", "focus"), "mental", "Pressure training",
     ["Play serve-only games to a target with the score out loud.",
      "Rally to 100 in a row; any miss resets to zero.",
      "Use the same pre-point routine on every ball."], "Same routine, every score."),
    (("fitness", "endurance", "stamina", "cardio"), "fitness", "On-court fitness",
     ["Baseline-to-net sprints, 8 reps.",
      "Shadow swings at tempo, 3 sets of 20.",
      "Suicides / spider runs, 4 rounds."], "Recover fast between reps."),
]


def _clean_drill(d: dict, goal: str) -> dict:
    intensity = str(d.get("intensity", "medium")).lower()
    if intensity not in INTENSITY_MINUTES:
        intensity = "medium"
    steps = d.get("steps") or []
    steps = [str(s)[:160] for s in steps][:6]
    return {
        "name": str(d.get("name") or "Custom drill")[:80],
        "focus": str(d.get("focus") or "")[:200],
        "category": str(d.get("category") or "custom")[:24],
        "intensity": intensity,
        "sets": max(1, min(int(d.get("sets", 3) or 3), 10)),
        "reps": max(1, min(int(d.get("reps", 15) or 15), 60)),
        "steps": steps,
        "goal": str(goal)[:200],
    }


def dynamic_drill(goal: str) -> dict:
    """Rule-based drill from a free-text goal. Always available, no keys."""
    g = (goal or "").lower()
    for keywords, category, name, steps, cue in _GOAL_RULES:
        if any(k in g for k in keywords):
            return _clean_drill({
                "name": name, "category": category, "intensity": "medium",
                "sets": 3, "reps": 15, "steps": steps, "focus": cue,
            }, goal)
    # generic all-round
    return _clean_drill({
        "name": "All-round tune-up", "category": "consistency", "intensity": "medium",
        "sets": 3, "reps": 15, "focus": "Balanced work toward: " + (goal or "your game") + ".",
        "steps": ["Warm up with 20 controlled cross-court rallies.",
                  "Footwork: split-step starts and recoveries, 3 sets of 10.",
                  "Target practice into the deep corners, 3 sets of 12."],
    }, goal)


def _drill_prompt(goal: str) -> str:
    return (
        "You are a tennis coach. Generate ONE practice drill for this player goal, "
        "as strict JSON with keys: name (string), focus (string, one coaching sentence), "
        "category (one word), intensity ('low'|'medium'|'high'), sets (int), reps (int), "
        "steps (array of 3-4 short instruction strings). No markdown, JSON only.\n"
        f"Goal: {goal}"
    )


def _parse_drill_json(text: str, goal: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[4:] if text.lower().startswith("json") else text
    return _clean_drill(json.loads(text), goal)


def _openai_drill(goal: str, key: str) -> dict:
    """Works with any OpenAI-compatible endpoint: Groq, OpenRouter, Together,
    Mistral, a local Ollama, etc. Set AI_BASE_URL + AI_MODEL to pick one."""
    base = os.getenv("AI_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model = os.getenv("AI_MODEL", "llama-3.1-8b-instant")
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": _drill_prompt(goal)}],
        "temperature": 0.7,
    }).encode()
    req = urllib.request.Request(
        base + "/chat/completions", data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
    return _parse_drill_json(resp["choices"][0]["message"]["content"], goal)


def _gemini_drill(goal: str, key: str) -> dict:
    body = json.dumps({"contents": [{"parts": [{"text": _drill_prompt(goal)}]}]}).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    resp = json.loads(urllib.request.urlopen(req, timeout=20).read())
    return _parse_drill_json(resp["candidates"][0]["content"]["parts"][0]["text"], goal)


def generate_drill(goal: str) -> dict:
    """Use whichever AI is configured, else the free rule-based generator.
    Priority: any OpenAI-compatible provider (AI_API_KEY) -> Gemini -> rules."""
    ai_key = os.getenv("AI_API_KEY")
    if ai_key:
        try:
            return _openai_drill(goal, ai_key)
        except Exception:
            pass
    gem = os.getenv("GEMINI_API_KEY")
    if gem:
        try:
            return _gemini_drill(goal, gem)
        except Exception:
            pass
    return dynamic_drill(goal)


def _prescribe(drill: dict, sets: int, flaw: dict | None, priority_base: float) -> PrescribedDrill:
    est = INTENSITY_MINUTES[drill["intensity"]] * max(1, round(sets / drill["default_sets"]))
    targets = [flaw.get("label", "")] if flaw and flaw.get("label") else []
    priority = priority_base + (0.4 if flaw else 0.0)
    return PrescribedDrill(
        id=drill["id"], name=drill["name"], category=drill["category"],
        focus=drill["focus"], sets=sets, reps=drill["default_reps"],
        intensity=drill["intensity"], equipment=drill["equipment"],
        targets=targets, est_minutes=est, priority=round(priority, 3),
        coaching_cue=drill.get("coaching_cue", ""), steps=list(drill.get("steps", [])),
    )
