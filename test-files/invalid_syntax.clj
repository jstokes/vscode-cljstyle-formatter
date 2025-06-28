(ns test.invalid-syntax)

(defn broken-function [a b]
  (let [x a
        y b]
    (+ x y) ; This line is fine
  (println "Missing closing paren for let"
  ; <- Missing ) here

(def another-broken-thing
  {:a 1 :b}) ; <- Missing value for :b

(defn yet-another
  [foo bar]
  (str foo bar)
  (/ 1 0)) ; Valid clojure, but might cause runtime error if eval'd, cljstyle should be fine


(comment
  (broken-function 1 2)
  (yet-another "a" "b")
