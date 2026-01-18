update public.letter_items set code = 'crossed-cascades' where kind = 'badge' and code = 'crossed_cascades';
update public.letter_items set code = 'crossed-rockies' where kind = 'badge' and code = 'crossed_rockies';
update public.letter_items set code = 'across-great-plains' where kind = 'badge' and code = 'across_the_plains';
update public.letter_items set code = 'crossed-appalachians' where kind = 'badge' and code = 'crossed_appalachians';
update public.letter_items set code = 'over-snake-river-plain' where kind = 'badge' and code = 'over_snake_river_plain';

update public.letter_items set icon = '/badges/crossed-cascades.svg' where kind = 'badge' and code = 'crossed-cascades';
update public.letter_items set icon = '/badges/crossed-rockies.svg' where kind = 'badge' and code = 'crossed-rockies';
update public.letter_items set icon = '/badges/across-great-plains.svg' where kind = 'badge' and code = 'across-great-plains';
update public.letter_items set icon = '/badges/crossed-appalachians.svg' where kind = 'badge' and code = 'crossed-appalachians';
update public.letter_items set icon = '/badges/over-snake-river-plain.svg' where kind = 'badge' and code = 'over-snake-river-plain';
update public.letter_items set icon = '/badges/delivered.svg' where kind = 'badge' and code = 'delivered';
