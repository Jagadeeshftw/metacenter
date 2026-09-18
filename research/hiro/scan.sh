o=0; while [ $o -lt 20000 ]; do
 f=ev/p$o.json; [ -s $f ] || curl -s "https://api.hiro.so/extended/v1/contract/SP000000000000000000002Q6VF78.pox-5/events?limit=50&offset=$o" -o $f
 n=$(jq '.results|length' $f 2>/dev/null); [ "$n" = "50" ] || { echo "stop at $o n=$n"; head -c 300 $f; break; }
 c=$(cat ev/p*.json | grep -o 'topic \\"calculate-rewards\\"' | wc -l); echo "$o calc=$c"
 o=$((o+50)); sleep 1.1
done
