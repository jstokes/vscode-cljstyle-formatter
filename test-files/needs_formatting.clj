(ns test.needs-formatting
  (:require
    [clojure.string :as str]))


(defn poorly-formatted-function
  [a b c]
  (if (> a b)
    (do (println "a is greater")
        (+ a c))
    (do (println "b is greater or equal")
        (* b c))))


(def my-map
  {:key1 "value1"
   :key2          "value2"
   :another-key {:nested-key1 100 :nested-key2 200}})


(defn another-fn
  []
  (let [x 1 y 2] (+ x y)))


(comment
  (poorly-formatted-function 1 2 3)
  (another-fn)
  )
