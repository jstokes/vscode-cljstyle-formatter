(defn poorly-formatted-function
  [a b c]
  (if (> a b)
    (do (println "a is greater")
        (+ a c))
    (do (println "b is greater or equal")
        (* b c))))
